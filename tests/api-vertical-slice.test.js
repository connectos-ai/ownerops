import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerOpsServer } from '../apps/api/src/server.js';

test('api supports standalone task and mock email triage vertical slice', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await requestJson(baseUrl, 'GET', '/healthz');
    assert.equal(health.ok, true);

    const workspace = await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_demo',
      name: 'Demo Team'
    });
    assert.equal(workspace.name, 'Demo Team');

    const owner = await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_demo/users', {
      id: 'user_owner',
      displayName: 'Owner'
    });
    assert.equal(owner.id, 'user_owner');

    const task = await requestJson(baseUrl, 'POST', '/api/tasks', {
      id: 'task_prepare',
      workspaceId: 'workspace_demo',
      title: 'Prepare launch checklist',
      createdBy: 'user_owner',
      ownerId: 'user_owner',
      dueAt: '2026-01-02T09:00:00.000Z'
    });
    assert.equal(task.status, 'INBOX');

    const blocked = await requestJson(baseUrl, 'PATCH', '/api/tasks/task_prepare/status', {
      workspaceId: 'workspace_demo',
      status: 'BLOCKED',
      actorId: 'user_owner',
      blockedReason: 'Waiting on final checklist'
    });
    assert.equal(blocked.status, 'BLOCKED');
    assert.equal(blocked.blockedReason, 'Waiting on final checklist');

    const decision = await requestJson(baseUrl, 'POST', '/api/tasks/task_prepare/owner-decision', {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner',
      reason: 'Final launch approval is required'
    });
    assert.equal(decision.status, 'NEEDS_OWNER');

    const resolved = await requestJson(baseUrl, 'POST', '/api/tasks/task_prepare/owner-decision/resolve', {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner',
      decision: 'Approve launch after checklist is complete'
    });
    assert.equal(resolved.status, 'READY');

    const emailSuggestion = await requestJson(baseUrl, 'POST', '/api/triage/email', {
      workspaceId: 'workspace_demo',
      defaultOwnerId: 'user_owner',
      email: {
        id: 'email_follow_up',
        subject: 'Customer follow-up',
        from: 'customer@example.com',
        receivedAt: '2026-01-01T12:00:00.000Z',
        body: 'Please follow up with the customer by Friday and send a clear answer.'
      }
    });
    assert.equal(emailSuggestion.shouldBecomeTask, true);
    assert.equal(emailSuggestion.task.sourceReference, 'email_follow_up');

    const approved = await requestJson(baseUrl, 'POST', `/api/triage/suggestions/${emailSuggestion.id}/approve`, {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner'
    });
    assert.equal(approved.sourceReference, 'email_follow_up');

    const duplicate = await requestJson(baseUrl, 'POST', `/api/triage/suggestions/${emailSuggestion.id}/approve`, {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner'
    });
    assert.equal(duplicate.id, approved.id);

    const referenceOnlySuggestion = await requestJson(baseUrl, 'POST', '/api/triage/email', {
      workspaceId: 'workspace_demo',
      defaultOwnerId: 'user_owner',
      email: {
        id: 'email_reference_only',
        subject: 'Newsletter',
        from: 'updates@example.com',
        receivedAt: '2026-01-01T13:00:00.000Z',
        body: 'This is a general update for later reading.'
      }
    });
    const rejected = await requestJson(baseUrl, 'POST', `/api/triage/suggestions/${referenceOnlySuggestion.id}/reject`, {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner',
      reason: 'Reference only.'
    });
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.rejectionReason, 'Reference only.');

    await requestJson(baseUrl, 'POST', '/api/tasks', {
      id: 'task_prepare_duplicate',
      workspaceId: 'workspace_demo',
      title: 'Duplicate launch checklist',
      createdBy: 'user_owner',
      ownerId: 'user_owner',
      sourceType: 'manual',
      sourceReference: 'manual_duplicate_checklist'
    });
    const merged = await requestJson(baseUrl, 'POST', '/api/tasks/task_prepare_duplicate/merge-duplicate', {
      workspaceId: 'workspace_demo',
      canonicalTaskId: 'task_prepare',
      actorId: 'user_owner',
      reason: 'Same launch checklist work.'
    });
    assert.equal(merged.status, 'CANCELLED');
    assert.equal(merged.archivedAt.length > 0, true);
    assert.equal(merged.mergedIntoTaskId, 'task_prepare');
    assert.equal(merged.history.at(-1).eventType, 'task.merged');

    const board = await requestJson(baseUrl, 'GET', '/api/boards/kanban?workspaceId=workspace_demo');
    assert.equal(board.READY.length, 2);

    const daily = await requestJson(baseUrl, 'GET', '/api/briefs/daily?workspaceId=workspace_demo&now=2026-01-02T08:00:00.000Z');
    assert.equal(daily.dueToday.length, 2);
    assert.equal(daily.recommendedNextMove.includes('today'), true);

    const weekly = await requestJson(baseUrl, 'GET', '/api/briefs/weekly?workspaceId=workspace_demo');
    assert.equal(weekly.carriedForward.length, 2);
  } finally {
    await closeServer(server);
  }
});

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
