import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createOwnerOpsServer } from '../apps/api/src/server.js';
import {
  createSlackSignature,
  parseSlackInteractionBody,
  verifySlackRequest
} from '../packages/slack/src/index.js';

const signingSecret = 'fictional_signing_secret_for_tests';

test('slack request verifier accepts valid signatures and rejects tampering or stale timestamps', () => {
  const now = 1_700_000_000;
  const body = 'payload=%7B%22type%22%3A%22block_actions%22%7D';
  const timestamp = String(now);
  const signature = createSlackSignature({ signingSecret, timestamp, body });

  assert.equal(verifySlackRequest({ signingSecret, timestamp, signature, body, now }).ok, true);
  assert.equal(verifySlackRequest({ signingSecret, timestamp, signature, body: `${body}x`, now }).ok, false);
  assert.equal(verifySlackRequest({ signingSecret, timestamp: String(now - 301), signature, body, now }).reason, 'stale_timestamp');
});

test('slack URL verification requires valid signature and echoes challenge', async () => {
  const app = createOwnerOpsServer({ slackSigningSecret: signingSecret });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const body = JSON.stringify({ type: 'url_verification', challenge: 'challenge_value' });
    const response = await signedRequest(baseUrl, '/slack/events', body, 'application/json');
    assert.equal(response.challenge, 'challenge_value');

    const rejected = await fetch(`${baseUrl}/slack/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    });
    assert.equal(rejected.status, 401);
  } finally {
    await closeServer(server);
  }
});

test('slack interaction updates canonical task status and is idempotent for retries', async () => {
  const app = createOwnerOpsServer({ slackSigningSecret: signingSecret });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_demo',
      name: 'Demo Team',
      policies: { slackTeamId: 'T_DEMO' }
    });
    await requestJson(baseUrl, 'POST', '/api/tasks', {
      id: 'task_slack_status',
      workspaceId: 'workspace_demo',
      title: 'Update customer checklist',
      createdBy: 'user_owner',
      ownerId: 'user_owner'
    });

    const payload = {
      type: 'block_actions',
      team: { id: 'T_DEMO' },
      user: { id: 'U_DEMO' },
      actions: [{
        action_id: 'ownerops_task_status',
        action_ts: '1700000000.000001',
        value: JSON.stringify({
          workspaceId: 'workspace_demo',
          taskId: 'task_slack_status',
          status: 'DONE'
        })
      }]
    };
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
    const first = await signedRequest(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');
    const second = await signedRequest(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');
    const tasks = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_demo&includeArchived=true');

    assert.equal(first.response_type, 'ephemeral');
    assert.equal(first.text, 'OwnerOps updated task_slack_status to DONE.');
    assert.equal(second.text, 'OwnerOps already handled this Slack action.');
    assert.equal(tasks.tasks[0].status, 'DONE');
    assert.equal(tasks.tasks[0].history.filter((event) => event.eventType === 'task.completed').length, 1);
  } finally {
    await closeServer(server);
  }
});

test('slack message shortcut creates canonical task with source metadata and duplicate protection', async () => {
  const app = createOwnerOpsServer({ slackSigningSecret: signingSecret });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_demo',
      name: 'Demo Team',
      policies: { slackTeamId: 'T_DEMO' }
    });

    const payload = {
      type: 'message_action',
      callback_id: 'ownerops_turn_message_into_task',
      trigger_id: 'trigger_demo',
      team: { id: 'T_DEMO' },
      channel: { id: 'C_DEMO', name: 'ownerops-inbox' },
      user: { id: 'U_DEMO', username: 'owner' },
      message: {
        type: 'message',
        user: 'U_REQUESTER',
        text: 'Please follow up with customer by Friday.',
        ts: '1700000000.000300',
        permalink: 'https://example.slack.com/archives/C_DEMO/p1700000000000300'
      }
    };
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
    const first = await signedRequest(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');
    const second = await signedRequest(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');
    const tasks = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_demo&query=follow');

    assert.equal(first.text, 'OwnerOps created task_from_slack_CDEMO_1700000000000300 from Slack.');
    assert.equal(second.text, 'OwnerOps already handled this Slack action.');
    assert.equal(tasks.tasks.length, 1);
    assert.equal(tasks.tasks[0].sourceType, 'slack_message');
    assert.equal(tasks.tasks[0].sourceReference, 'T_DEMO:C_DEMO:1700000000.000300');
    assert.equal(tasks.tasks[0].sourceUrl, 'https://example.slack.com/archives/C_DEMO/p1700000000000300');
    assert.equal(tasks.tasks[0].requestedBy, 'slack:U_REQUESTER');
    assert.match(tasks.tasks[0].desiredOutcome, /follow up/i);
  } finally {
    await closeServer(server);
  }
});

test('slack interaction rejects cross-workspace team mismatch', async () => {
  const app = createOwnerOpsServer({ slackSigningSecret: signingSecret });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_demo',
      name: 'Demo Team',
      policies: { slackTeamId: 'T_DEMO' }
    });
    await requestJson(baseUrl, 'POST', '/api/tasks', {
      id: 'task_slack_status',
      workspaceId: 'workspace_demo',
      title: 'Update customer checklist',
      createdBy: 'user_owner',
      ownerId: 'user_owner'
    });

    const payload = {
      type: 'block_actions',
      team: { id: 'T_OTHER' },
      user: { id: 'U_DEMO' },
      actions: [{
        action_id: 'ownerops_task_status',
        action_ts: '1700000000.000002',
        value: JSON.stringify({
          workspaceId: 'workspace_demo',
          taskId: 'task_slack_status',
          status: 'DONE'
        })
      }]
    };
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
    const response = await signedFetch(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');

    assert.equal(response.status, 403);
  } finally {
    await closeServer(server);
  }
});

test('slack interaction parser accepts payload form bodies', () => {
  const payload = { type: 'block_actions', actions: [] };
  assert.deepEqual(
    parseSlackInteractionBody(new URLSearchParams({ payload: JSON.stringify(payload) }).toString()),
    payload
  );
});

async function signedRequest(baseUrl, path, body, contentType) {
  const response = await signedFetch(baseUrl, path, body, contentType);
  const data = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  return data;
}

async function signedFetch(baseUrl, path, body, contentType) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature
    },
    body
  });
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
