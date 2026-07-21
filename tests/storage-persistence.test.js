import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createOwnerOpsServer } from '../apps/api/src/server.js';
import { FileOwnerOpsStore } from '../packages/storage/src/index.js';

test('file store persists workspace task data across server restarts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ownerops-store-'));
  const dataFile = join(dir, 'ownerops-data.json');

  try {
    await withServer(new FileOwnerOpsStore({ filePath: dataFile }), async (baseUrl) => {
      await requestJson(baseUrl, 'POST', '/api/workspaces', { id: 'workspace_alpha', name: 'Alpha Team' });
      await requestJson(baseUrl, 'POST', '/api/workspaces', { id: 'workspace_beta', name: 'Beta Team' });
      await requestJson(baseUrl, 'POST', '/api/tasks', {
        id: 'task_alpha_plan',
        workspaceId: 'workspace_alpha',
        title: 'Write operating plan',
        createdBy: 'user_owner',
        ownerId: 'user_owner',
        tags: ['planning']
      });
      await requestJson(baseUrl, 'POST', '/api/tasks', {
        id: 'task_beta_plan',
        workspaceId: 'workspace_beta',
        title: 'Write private beta plan',
        createdBy: 'user_owner',
        ownerId: 'user_owner',
        tags: ['planning']
      });
      await requestJson(baseUrl, 'POST', '/api/tasks/task_alpha_plan/comments', {
        workspaceId: 'workspace_alpha',
        authorId: 'user_owner',
        body: 'Persist this comment.'
      });
    });

    await withServer(new FileOwnerOpsStore({ filePath: dataFile }), async (baseUrl) => {
      const alphaTasks = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_alpha&query=operating');
      assert.deepEqual(alphaTasks.tasks.map((task) => task.id), ['task_alpha_plan']);
      assert.equal(alphaTasks.tasks[0].comments[0].body, 'Persist this comment.');

      const betaTasks = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_beta&query=operating');
      assert.deepEqual(betaTasks.tasks, []);

      const board = await requestJson(baseUrl, 'GET', '/api/boards/kanban?workspaceId=workspace_alpha');
      assert.deepEqual(board.INBOX.map((task) => task.id), ['task_alpha_plan']);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function withServer(store, fn) {
  const app = createOwnerOpsServer({ store });
  const server = app.listen(0);
  await onceListening(server);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await closeServer(server);
  }
}

async function requestJson(baseUrl, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

function onceListening(server) {
  return new Promise((resolve) => server.once('listening', resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
