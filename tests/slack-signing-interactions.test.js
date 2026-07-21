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

test('slack slash command creates a canonical task from command text', async () => {
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

    const commandBody = new URLSearchParams({
      token: 'deprecated_verification_token_ignored',
      team_id: 'T_DEMO',
      team_domain: 'demo',
      channel_id: 'C_DEMO',
      channel_name: 'ownerops-inbox',
      user_id: 'U_DEMO',
      user_name: 'owner',
      command: '/ownerops',
      text: 'task Prepare weekly checklist',
      response_url: 'https://hooks.slack.com/commands/example',
      trigger_id: 'trigger_demo'
    }).toString();

    const response = await signedRequest(baseUrl, '/slack/commands', commandBody, 'application/x-www-form-urlencoded');
    const tasks = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_demo&query=weekly');

    assert.equal(response.response_type, 'ephemeral');
    assert.equal(response.text, 'OwnerOps created task_from_slack_command_TDEMO_CDEMO_UDEMO.');
    assert.equal(tasks.tasks.length, 1);
    assert.equal(tasks.tasks[0].title, 'Prepare weekly checklist');
    assert.equal(tasks.tasks[0].sourceType, 'slack_command');
    assert.equal(tasks.tasks[0].sourceReference, 'T_DEMO:C_DEMO:U_DEMO:/ownerops:task Prepare weekly checklist');
    assert.equal(tasks.tasks[0].createdBy, 'slack:U_DEMO');
    assert.equal(tasks.tasks[0].requestedBy, 'slack:U_DEMO');
  } finally {
    await closeServer(server);
  }
});

test('slack modal submission creates canonical task from submitted fields', async () => {
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
      type: 'view_submission',
      team: { id: 'T_DEMO' },
      user: { id: 'U_DEMO' },
      view: {
        id: 'V_DEMO',
        hash: 'view_hash_demo',
        callback_id: 'ownerops_task_create',
        state: {
          values: {
            title_block: {
              title_action: {
                type: 'plain_text_input',
                value: 'Call vendor about invoice'
              }
            },
            description_block: {
              description_action: {
                type: 'plain_text_input',
                value: 'Need a clear answer before close of business.'
              }
            },
            due_date_block: {
              due_date_action: {
                type: 'datepicker',
                selected_date: '2026-08-01'
              }
            },
            priority_block: {
              priority_action: {
                type: 'static_select',
                selected_option: {
                  value: 'HIGH'
                }
              }
            }
          }
        }
      }
    };
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();

    const first = await signedRequest(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');
    const second = await signedRequest(baseUrl, '/slack/interactions', body, 'application/x-www-form-urlencoded');
    const tasks = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_demo&query=vendor');

    assert.equal(first.response_action, 'clear');
    assert.equal(first.text, 'OwnerOps created task_from_slack_modal_VDEMO.');
    assert.equal(second.text, 'OwnerOps already handled Slack modal.');
    assert.equal(tasks.tasks.length, 1);
    assert.equal(tasks.tasks[0].sourceType, 'slack_modal');
    assert.equal(tasks.tasks[0].sourceReference, 'T_DEMO:V_DEMO:view_hash_demo');
    assert.equal(tasks.tasks[0].title, 'Call vendor about invoice');
    assert.equal(tasks.tasks[0].description, 'Need a clear answer before close of business.');
    assert.equal(tasks.tasks[0].dueAt, '2026-08-01T00:00:00.000Z');
    assert.equal(tasks.tasks[0].priority, 'HIGH');
    assert.equal(tasks.tasks[0].createdBy, 'slack:U_DEMO');
  } finally {
    await closeServer(server);
  }
});

test('slack slash command rejects unmapped teams', async () => {
  const app = createOwnerOpsServer({ slackSigningSecret: signingSecret });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const commandBody = new URLSearchParams({
      team_id: 'T_UNKNOWN',
      channel_id: 'C_DEMO',
      user_id: 'U_DEMO',
      command: '/ownerops',
      text: 'task Prepare weekly checklist'
    }).toString();
    const response = await signedFetch(baseUrl, '/slack/commands', commandBody, 'application/x-www-form-urlencoded');

    assert.equal(response.status, 404);
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

test('slack oauth installs workspace with encrypted tokens', async () => {
  const app = createOwnerOpsServer({
    slackSigningSecret: signingSecret,
    slackOAuth: {
      clientId: 'client_demo',
      clientSecret: 'client_demo_private',
      redirectUri: 'https://ownerops.example/slack/oauth/callback',
      stateSecret: 'state_secret_demo',
      tokenEncryptionKey: 'local_encryption_key_for_tests',
      exchangeOAuthCode: async ({ code, redirectUri }) => {
        assert.equal(code, 'code_demo');
        assert.equal(redirectUri, 'https://ownerops.example/slack/oauth/callback');
        return {
          ok: true,
          access_token: 'bot_token_demo',
          scope: 'commands,chat:write',
          team: { id: 'T_DEMO', name: 'Demo Team' },
          bot_user_id: 'B_DEMO',
          authed_user: {
            id: 'U_INSTALLER',
            access_token: 'user_token_demo',
            scope: 'users:read'
          }
        };
      }
    }
  });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_demo',
      name: 'Demo Team',
      policies: { slackTeamId: 'T_DEMO' }
    });

    const start = await requestJson(baseUrl, 'GET', '/slack/oauth/start?workspaceId=workspace_demo');
    const authorizeUrl = new URL(start.authorizeUrl);
    assert.equal(authorizeUrl.hostname, 'slack.com');
    assert.equal(authorizeUrl.pathname, '/oauth/v2/authorize');
    assert.equal(authorizeUrl.searchParams.get('client_id'), 'client_demo');
    assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://ownerops.example/slack/oauth/callback');
    assert.match(authorizeUrl.searchParams.get('scope'), /commands/);

    const callback = await requestJson(
      baseUrl,
      'GET',
      `/slack/oauth/callback?code=code_demo&state=${encodeURIComponent(authorizeUrl.searchParams.get('state'))}`
    );
    const installation = app.ownerOpsStore.getSlackInstallationByTeam('T_DEMO');
    const snapshotText = JSON.stringify(app.ownerOpsStore.snapshot());

    assert.equal(callback.ok, true);
    assert.equal(callback.workspaceId, 'workspace_demo');
    assert.equal(callback.teamId, 'T_DEMO');
    assert.equal(installation.status, 'ACTIVE');
    assert.equal(installation.botUserId, 'B_DEMO');
    assert.notEqual(installation.botToken.ciphertext, 'bot_token_demo');
    assert.notEqual(installation.authedUserToken.ciphertext, 'user_token_demo');
    assert.equal(snapshotText.includes('bot_token_demo'), false);
    assert.equal(snapshotText.includes('user_token_demo'), false);
  } finally {
    await closeServer(server);
  }
});

test('slack oauth rejects invalid state', async () => {
  const app = createOwnerOpsServer({
    slackOAuth: {
      clientId: 'client_demo',
      clientSecret: 'client_demo_private',
      redirectUri: 'https://ownerops.example/slack/oauth/callback',
      stateSecret: 'state_secret_demo',
      tokenEncryptionKey: 'local_encryption_key_for_tests',
      exchangeOAuthCode: async () => {
        throw new Error('state should fail before exchange');
      }
    }
  });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetch(`${baseUrl}/slack/oauth/callback?code=code_demo&state=tampered_state`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'SLACK_OAUTH_STATE_INVALID');
  } finally {
    await closeServer(server);
  }
});

test('slack uninstall event revokes stored installation tokens', async () => {
  const app = createOwnerOpsServer({
    slackSigningSecret: signingSecret,
    slackOAuth: {
      clientId: 'client_demo',
      clientSecret: 'client_demo_private',
      redirectUri: 'https://ownerops.example/slack/oauth/callback',
      stateSecret: 'state_secret_demo',
      tokenEncryptionKey: 'local_encryption_key_for_tests',
      exchangeOAuthCode: async () => ({
        ok: true,
        access_token: 'bot_token_demo',
        team: { id: 'T_DEMO', name: 'Demo Team' },
        bot_user_id: 'B_DEMO'
      })
    }
  });
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_demo',
      name: 'Demo Team',
      policies: { slackTeamId: 'T_DEMO' }
    });
    const start = await requestJson(baseUrl, 'GET', '/slack/oauth/start?workspaceId=workspace_demo');
    const state = new URL(start.authorizeUrl).searchParams.get('state');
    await requestJson(baseUrl, 'GET', `/slack/oauth/callback?code=code_demo&state=${encodeURIComponent(state)}`);

    const eventBody = JSON.stringify({
      type: 'event_callback',
      team_id: 'T_DEMO',
      event_id: 'Ev_DEMO',
      event_time: 1_700_000_000,
      event: { type: 'app_uninstalled' }
    });
    const response = await signedRequest(baseUrl, '/slack/events', eventBody, 'application/json');
    const installation = app.ownerOpsStore.getSlackInstallationByTeam('T_DEMO');

    assert.equal(response.ok, true);
    assert.equal(installation.status, 'REVOKED');
    assert.equal(installation.botToken, null);
    assert.equal(installation.revokedReason, 'app_uninstalled');
  } finally {
    await closeServer(server);
  }
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
