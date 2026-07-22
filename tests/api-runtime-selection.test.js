import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConfiguredOwnerOpsServer,
  InMemoryOwnerOpsStore
} from '../apps/api/src/server.js';

test('configured server uses postgres store only when storage mode explicit', async () => {
  const calls = [];
  const inner = new InMemoryOwnerOpsStore();
  const server = await createConfiguredOwnerOpsServer({
    storage: 'postgres',
    databaseUrl: 'postgres://ownerops:example@localhost:5432/ownerops',
    createPostgresOwnerOpsStore: async (options) => {
      calls.push(options);
      return {
        store: new MigratingStore(inner),
        async close() {
          calls.push({ closed: true });
        }
      };
    }
  });

  assert.equal(server.ownerOpsStorageMode, 'postgres');
  assert.equal(server.ownerOpsStore.migrationsRun, 1);
  assert.equal(calls[0].connectionString, 'postgres://ownerops:example@localhost:5432/ownerops');
  await server.ownerOpsClose();
  assert.deepEqual(calls[1], { closed: true });
});

test('configured server keeps local store when database URL exists without storage mode', async () => {
  const server = await createConfiguredOwnerOpsServer({
    databaseUrl: 'postgres://ownerops:example@localhost:5432/ownerops',
    createPostgresOwnerOpsStore: async () => {
      throw new Error('postgres factory should not be called without explicit storage mode');
    }
  });

  assert.equal(server.ownerOpsStorageMode, 'memory');
  assert.ok(server.ownerOpsStore instanceof InMemoryOwnerOpsStore);
});

class MigratingStore {
  constructor(inner) {
    this.inner = inner;
    this.migrationsRun = 0;
  }

  async migrate() {
    this.migrationsRun += 1;
    return { currentVersion: 1 };
  }

  async createWorkspace(...args) { return this.inner.createWorkspace(...args); }
  async requireWorkspace(...args) { return this.inner.requireWorkspace(...args); }
  async addWorkspaceUser(...args) { return this.inner.addWorkspaceUser(...args); }
  async createProject(...args) { return this.inner.createProject(...args); }
  async createTaskList(...args) { return this.inner.createTaskList(...args); }
  async createTask(...args) { return this.inner.createTask(...args); }
  async getTask(...args) { return this.inner.getTask(...args); }
  async updateTask(...args) { return this.inner.updateTask(...args); }
  async listTasks(...args) { return this.inner.listTasks(...args); }
  async allTasks(...args) { return this.inner.allTasks(...args); }
  async addTaskComment(...args) { return this.inner.addTaskComment(...args); }
  async addSubtask(...args) { return this.inner.addSubtask(...args); }
  async archiveTask(...args) { return this.inner.archiveTask(...args); }
  async reopenTask(...args) { return this.inner.reopenTask(...args); }
  async saveSuggestion(...args) { return this.inner.saveSuggestion(...args); }
  async getSuggestion(...args) { return this.inner.getSuggestion(...args); }
  async createTaskFromSuggestion(...args) { return this.inner.createTaskFromSuggestion(...args); }
}
