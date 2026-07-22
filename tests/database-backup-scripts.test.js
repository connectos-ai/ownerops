import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('database backup writes dump and checksum without printing database URL', async () => {
  const fixture = createFixture();
  const backupFile = join(fixture.dir, 'backup.dump');

  await writeMockCommand(fixture.bin, 'pg_dump', `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "$OWNEROPS_TEST_LOG"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--file" ]; then
    shift
    printf 'ownerops dump\\n' > "$1"
    exit 0
  fi
  shift
done
exit 2
`);

  const result = await runScript('scripts/backup-database.sh', [], {
    DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/source',
    OWNEROPS_DATABASE_BACKUP_FILE: backupFile,
    OWNEROPS_TEST_LOG: fixture.log,
    PATH: `${fixture.bin}:${process.env.PATH}`
  });

  assert.equal(result.stdout.trim(), backupFile);
  assert.match(readFileSync(backupFile, 'utf8'), /ownerops dump/);
  assert.ok(readFileSync(`${backupFile}.sha256`, 'utf8').includes(backupFile));
  assert.doesNotMatch(result.stdout, /secret/);
  assert.match(readFileSync(fixture.log, 'utf8'), /--format=custom/);
  assert.match(readFileSync(fixture.log, 'utf8'), /--no-owner/);
});

test('database restore requires explicit destructive confirmation', async () => {
  const fixture = createFixture();
  const backupFile = join(fixture.dir, 'backup.dump');
  writeFileSync(backupFile, 'ownerops dump\n');

  await assert.rejects(
    runScript('scripts/restore-database.sh', [backupFile], {
      DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/target'
    }),
    /restore refused/
  );
});

test('database restore verifies checksum and calls pg_restore safely', async () => {
  const fixture = createFixture();
  const backupFile = join(fixture.dir, 'backup.dump');
  writeFileSync(backupFile, 'ownerops dump\n');
  await runCommand('shasum', ['-a', '256', backupFile], { cwd: process.cwd() })
    .then(({ stdout }) => writeFileSync(`${backupFile}.sha256`, stdout));

  await writeMockCommand(fixture.bin, 'pg_restore', `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "$OWNEROPS_TEST_LOG"
`);

  const result = await runScript('scripts/restore-database.sh', [backupFile], {
    OWNEROPS_RESTORE_CONFIRM: 'restore-ownerops-database',
    OWNEROPS_RESTORE_DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/target',
    OWNEROPS_TEST_LOG: fixture.log,
    PATH: `${fixture.bin}:${process.env.PATH}`
  });

  assert.match(result.stdout, /OwnerOps database restored/);
  const log = readFileSync(fixture.log, 'utf8');
  assert.match(log, /--clean/);
  assert.match(log, /--if-exists/);
  assert.match(log, /--no-owner/);
  assert.match(log, /--dbname/);
});

test('database restore-test refuses to restore into source database', async () => {
  await assert.rejects(
    runScript('scripts/restore-test-database.sh', [], {
      DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/source',
      OWNEROPS_RESTORE_TEST_DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/source'
    }),
    /must differ/
  );
});

test('database restore-test backs up, restores, and checks required tables', async () => {
  const fixture = createFixture();

  await writeMockCommand(fixture.bin, 'pg_dump', `#!/usr/bin/env bash
set -euo pipefail
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--file" ]; then
    shift
    printf 'ownerops dump\\n' > "$1"
    exit 0
  fi
  shift
done
exit 2
`);

  await writeMockCommand(fixture.bin, 'pg_restore', `#!/usr/bin/env bash
set -euo pipefail
printf 'restore %s\\n' "$@" >> "$OWNEROPS_TEST_LOG"
`);

  await writeMockCommand(fixture.bin, 'psql', `#!/usr/bin/env bash
set -euo pipefail
printf 'psql %s\\n' "$@" >> "$OWNEROPS_TEST_LOG"
printf 't\\n'
`);

  const result = await runScript('scripts/restore-test-database.sh', [], {
    DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/source',
    OWNEROPS_RESTORE_TEST_DATABASE_URL: 'postgres://ownerops:secret@example.local:5432/restore_test',
    OWNEROPS_TEST_LOG: fixture.log,
    PATH: `${fixture.bin}:${process.env.PATH}`
  });

  assert.match(result.stdout, /restore-test passed/);
  const log = readFileSync(fixture.log, 'utf8');
  assert.match(log, /restore/);
  assert.match(log, /psql/);
});

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ownerops-db-scripts-'));
  const bin = join(dir, 'bin');
  const log = join(dir, 'calls.log');
  return { dir, bin, log };
}

async function writeMockCommand(binDir, name, contents) {
  await runCommand('mkdir', ['-p', binDir]);
  const file = join(binDir, name);
  writeFileSync(file, contents);
  chmodSync(file, 0o755);
}

async function runScript(script, args, env) {
  return runCommand('bash', [script, ...args], { env: { ...process.env, ...env } });
}

async function runCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: process.cwd(),
    env: options.env || process.env,
    maxBuffer: 1024 * 1024
  });
}
