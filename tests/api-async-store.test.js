import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerOpsServer, InMemoryOwnerOpsStore } from '../apps/api/src/server.js';

test('api awaits asynchronous storage for standalone task operations', async () => {
  const app = createOwnerOpsServer({ store: new AsyncStore(new InMemoryOwnerOpsStore()) });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const workspace = await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_async',
      name: 'Async Team'
    });
    assert.equal(workspace.id, 'workspace_async');

    const owner = await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_async/users', {
      id: 'user_owner',
      displayName: 'Owner'
    });
    assert.equal(owner.displayName, 'Owner');

    const task = await requestJson(baseUrl, 'POST', '/api/tasks', {
      id: 'task_async',
      workspaceId: 'workspace_async',
      title: 'Check async API storage',
      createdBy: 'user_owner',
      ownerId: 'user_owner',
      sourceType: 'manual',
      sourceReference: 'manual_async_001'
    });
    assert.equal(task.status, 'INBOX');

    const started = await requestJson(baseUrl, 'PATCH', '/api/tasks/task_async/status', {
      workspaceId: 'workspace_async',
      status: 'IN_PROGRESS',
      actorId: 'user_owner'
    });
    assert.equal(started.status, 'IN_PROGRESS');

    const commented = await requestJson(baseUrl, 'POST', '/api/tasks/task_async/comments', {
      workspaceId: 'workspace_async',
      authorId: 'user_owner',
      body: 'Async comment persisted.'
    });
    assert.equal(commented.comments[0].body, 'Async comment persisted.');

    const archived = await requestJson(baseUrl, 'POST', '/api/tasks/task_async/archive', {
      workspaceId: 'workspace_async',
      actorId: 'user_owner'
    });
    assert.ok(archived.archivedAt);

    const activeOnly = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_async');
    const includeArchived = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_async&includeArchived=true');
    const daily = await requestJson(baseUrl, 'GET', '/api/briefs/daily?workspaceId=workspace_async');

    assert.deepEqual(activeOnly.tasks, []);
    assert.equal(includeArchived.tasks.length, 1);
    assert.equal(daily.blocked.length, 0);

    const suggestion = await requestJson(baseUrl, 'POST', '/api/triage/email', {
      workspaceId: 'workspace_async',
      defaultOwnerId: 'user_owner',
      email: {
        id: 'email_async_001',
        subject: 'Follow up needed',
        from: 'customer@example.com',
        receivedAt: '2026-01-01T12:00:00.000Z',
        body: 'Please follow up with the customer by Friday.'
      }
    });
    const approved = await requestJson(baseUrl, 'POST', `/api/triage/suggestions/${suggestion.id}/approve`, {
      workspaceId: 'workspace_async',
      actorId: 'user_owner'
    });
    const duplicate = await requestJson(baseUrl, 'POST', `/api/triage/suggestions/${suggestion.id}/approve`, {
      workspaceId: 'workspace_async',
      actorId: 'user_owner'
    });

    assert.equal(approved.id, duplicate.id);
    assert.equal(approved.sourceReference, 'email_async_001');
  } finally {
    await closeServer(server);
  }
});

class AsyncStore {
  constructor(inner) {
    this.inner = inner;
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

async function requestJson(baseUrl, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${path} failed: ${JSON.stringify(data)}`);
  return data;
}

function onceListening(server) {
  return new Promise((resolve) => server.once('listening', resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
