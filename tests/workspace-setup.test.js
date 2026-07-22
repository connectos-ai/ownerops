import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerOpsServer } from '../apps/api/src/server.js';

test('workspace setup is idempotent and exposes members projects lists', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const workspace = await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_setup',
      name: 'Setup Team'
    });
    assert.equal(workspace.name, 'Setup Team');

    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_setup/users', {
      id: 'user_owner',
      displayName: 'Owner'
    });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_setup/users', {
      id: 'user_owner',
      displayName: 'Owner'
    });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_setup/projects', {
      id: 'project_ops',
      name: 'Operations'
    });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_setup/projects', {
      id: 'project_ops',
      name: 'Operations'
    });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_setup/lists', {
      id: 'list_today',
      name: 'Today',
      projectId: 'project_ops'
    });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_setup/lists', {
      id: 'list_today',
      name: 'Today',
      projectId: 'project_ops'
    });

    const duplicateWorkspace = await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_setup',
      name: 'Setup Team'
    });
    assert.equal(duplicateWorkspace.users.length, 1);
    assert.equal(duplicateWorkspace.projects.length, 1);
    assert.equal(duplicateWorkspace.lists.length, 1);

    const fetched = await requestJson(baseUrl, 'GET', '/api/workspaces/workspace_setup');
    assert.deepEqual(fetched.users.map((user) => user.id), ['user_owner']);
    assert.deepEqual(fetched.projects.map((project) => project.id), ['project_ops']);
    assert.deepEqual(fetched.lists.map((list) => list.id), ['list_today']);
  } finally {
    await closeServer(server);
  }
});

test('workspace users support invitations identity mapping and deactivation without exposing raw email', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', {
      id: 'workspace_users',
      name: 'Users Team'
    });

    const invited = await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_users/users', {
      id: 'user_guest',
      displayName: 'Guest Reviewer',
      role: 'guest',
      status: 'invited',
      email: 'guest@example.com',
      slackUserId: 'U_EXAMPLE_GUEST',
      externalIds: {
        slackUserId: 'U_EXAMPLE_GUEST',
        emailProviderContactId: 'contact_example_guest'
      }
    });

    assert.equal(invited.status, 'invited');
    assert.equal(invited.role, 'guest');
    assert.equal(invited.email, undefined);
    assert.match(invited.emailHash, /^[a-f0-9]{64}$/);
    assert.equal(invited.externalIds.slackUserId, 'U_EXAMPLE_GUEST');
    assert.ok(invited.invitedAt);

    const activated = await requestJson(baseUrl, 'PATCH', '/api/workspaces/workspace_users/users/user_guest', {
      displayName: 'Guest Reviewer',
      role: 'member',
      status: 'active',
      externalIds: {
        crmContactId: 'crm_contact_example'
      }
    });

    assert.equal(activated.status, 'active');
    assert.equal(activated.role, 'member');
    assert.equal(activated.deactivatedAt, null);
    assert.equal(activated.externalIds.slackUserId, 'U_EXAMPLE_GUEST');
    assert.equal(activated.externalIds.crmContactId, 'crm_contact_example');

    const deactivated = await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_users/users/user_guest/deactivate', {
      actorId: 'user_admin'
    });

    assert.equal(deactivated.status, 'deactivated');
    assert.ok(deactivated.deactivatedAt);

    const workspace = await requestJson(baseUrl, 'GET', '/api/workspaces/workspace_users');
    assert.equal(workspace.users[0].email, undefined);
    assert.equal(workspace.users[0].status, 'deactivated');
  } finally {
    await closeServer(server);
  }
});

test('standalone web shell includes setup controls for team task management', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /id="workspace-form"/);
    assert.match(html, /id="workspace-select"/);
    assert.match(html, /id="member-form"/);
    assert.match(html, /id="project-form"/);
    assert.match(html, /id="list-form"/);
    assert.match(html, /id="task-project"/);
    assert.match(html, /id="task-list"/);
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
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
