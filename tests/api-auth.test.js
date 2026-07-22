import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerOpsServer } from '../apps/api/src/server.js';

test('api token guard is disabled by default for local standalone use', async () => {
  const { server, baseUrl } = await startServer(createOwnerOpsServer());
  try {
    const workspace = await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_open',
      name: 'Open Local Workspace'
    });

    assert.equal(workspace.id, 'workspace_open');
  } finally {
    await closeServer(server);
  }
});

test('api token guard rejects protected api routes without bearer token', async () => {
  const { server, baseUrl } = await startServer(createOwnerOpsServer({ apiToken: 'test-ownerops-api-token' }));
  try {
    const response = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'workspace_rejected', name: 'Rejected Workspace' })
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer realm="ownerops-api"');
    assert.equal(payload.error.code, 'OWNEROPS_API_UNAUTHORIZED');
  } finally {
    await closeServer(server);
  }
});

test('api token guard allows protected api routes with bearer token', async () => {
  const { server, baseUrl } = await startServer(createOwnerOpsServer({ apiToken: 'test-ownerops-api-token' }));
  try {
    const workspace = await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_allowed',
      name: 'Allowed Workspace'
    }, 'test-ownerops-api-token');

    assert.equal(workspace.id, 'workspace_allowed');
  } finally {
    await closeServer(server);
  }
});

test('api token guard protects oauth start but leaves slack webhooks on signature auth', async () => {
  const { server, baseUrl } = await startServer(createOwnerOpsServer({
    apiToken: 'test-ownerops-api-token',
    slackSigningSecret: 'test-slack-signing-secret'
  }));
  try {
    const oauthStart = await fetch(`${baseUrl}/slack/oauth/start?workspaceId=workspace_missing`);
    assert.equal(oauthStart.status, 401);
    const oauthPayload = await oauthStart.json();
    assert.equal(oauthPayload.error.code, 'OWNEROPS_API_UNAUTHORIZED');

    const slackEvent = await fetch(`${baseUrl}/slack/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'url_verification', challenge: 'example' })
    });
    assert.equal(slackEvent.status, 401);
    const slackPayload = await slackEvent.json();
    assert.match(slackPayload.error.code, /^SLACK_SIGNATURE_/);
  } finally {
    await closeServer(server);
  }
});

async function requestJson(baseUrl, method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function startServer(app) {
  const server = app.listen(0);
  await onceListening(server);
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

function onceListening(server) {
  return new Promise((resolve) => server.once('listening', resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
