import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OWNEROPS_RELATIONAL_MIGRATIONS,
  OWNEROPS_RELATIONAL_REQUIRED_INDEXES,
  OWNEROPS_RELATIONAL_REQUIRED_TABLES,
  findDisallowedPlaintextSecretColumns,
  getRelationalSchemaSql,
  validateRelationalSchema
} from '../packages/storage/src/index.js';

test('relational schema boundary is versioned and covers canonical tables', () => {
  const validation = validateRelationalSchema();

  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(validation.currentVersion, 1);
  assert.deepEqual(
    OWNEROPS_RELATIONAL_MIGRATIONS.map((migration) => migration.version),
    [1]
  );

  const sql = getRelationalSchemaSql();
  for (const table of OWNEROPS_RELATIONAL_REQUIRED_TABLES) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, 'i'));
  }
});

test('relational schema has workspace isolation indexes and source idempotency', () => {
  const sql = getRelationalSchemaSql();

  for (const index of OWNEROPS_RELATIONAL_REQUIRED_INDEXES) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS\\s+${index}\\b`, 'i'));
  }

  assert.match(sql, /PRIMARY KEY \(workspace_id, id\)/i);
  assert.match(sql, /uniq_tasks_workspace_source_reference/i);
  assert.match(sql, /ON tasks \(workspace_id, source_type, source_reference\)/i);
  assert.match(sql, /PRIMARY KEY \(workspace_id, action_key\)/i);
});

test('relational schema stores integration credentials only as encrypted records', () => {
  const sql = getRelationalSchemaSql();

  assert.match(sql, /encrypted_credentials JSONB NOT NULL/i);
  assert.deepEqual(findDisallowedPlaintextSecretColumns(sql), []);
  assert.deepEqual(
    findDisallowedPlaintextSecretColumns(`
      CREATE TABLE example (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        encrypted_refresh_token JSONB NOT NULL,
        signing_secret TEXT
      );
    `),
    ['access_token', 'signing_secret']
  );
});
