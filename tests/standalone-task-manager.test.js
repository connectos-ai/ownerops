import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskStatus,
  addSubtask,
  addTaskComment,
  addWorkspaceUser,
  archiveTask,
  changeSubtaskStatus,
  createProject,
  createRecurringTaskInstance,
  createTask,
  createTaskList,
  createWorkspace,
  reopenTask,
  searchTasks,
  updateTaskDetails
} from '../packages/core/src/index.js';
import { createOwnerOpsServer } from '../apps/api/src/server.js';

test('standalone users can organize work with projects lists comments subtasks and search', () => {
  const workspace = createWorkspace({ id: 'workspace_demo', name: 'Demo Team' });
  const owner = addWorkspaceUser(workspace, { id: 'user_owner', displayName: 'Owner' });
  const teammate = addWorkspaceUser(workspace, { id: 'user_ops', displayName: 'Ops Lead' });
  const project = createProject(workspace, { id: 'project_launch', name: 'Launch' });
  const list = createTaskList(workspace, { id: 'list_today', name: 'Today', projectId: project.id });

  let task = createTask({
    id: 'task_launch_brief',
    workspaceId: workspace.id,
    title: 'Write launch brief',
    createdBy: owner.id,
    ownerId: teammate.id,
    projectId: project.id,
    listId: list.id,
    tags: ['launch']
  });

  task = addTaskComment(task, {
    id: 'comment_scope',
    authorId: owner.id,
    body: 'Keep the brief to one page.'
  });
  task = addSubtask(task, {
    id: 'subtask_outline',
    title: 'Draft outline',
    ownerId: teammate.id
  });
  task = changeSubtaskStatus(task, 'subtask_outline', TaskStatus.DONE, { actorId: teammate.id });
  task = updateTaskDetails(task, {
    actorId: owner.id,
    priority: 'HIGH',
    dueAt: '2026-01-03T17:00:00.000Z',
    notes: 'Use the approved positioning.'
  });

  assert.equal(task.comments.length, 1);
  assert.equal(task.subtasks[0].status, TaskStatus.DONE);
  assert.equal(task.priority, 'HIGH');
  assert.equal(task.notes, 'Use the approved positioning.');

  const searchResults = searchTasks([task], {
    workspaceId: workspace.id,
    query: 'brief',
    ownerId: teammate.id,
    projectId: project.id,
    listId: list.id,
    tag: 'launch'
  });
  assert.deepEqual(searchResults.map((item) => item.id), ['task_launch_brief']);

  const archived = archiveTask(task, { actorId: owner.id });
  assert.ok(archived.archivedAt);
  assert.deepEqual(searchTasks([archived], { workspaceId: workspace.id }).map((item) => item.id), []);

  const reopened = reopenTask(archived, { actorId: owner.id });
  assert.equal(reopened.status, TaskStatus.READY);
  assert.equal(reopened.archivedAt, null);

  const nextRecurring = createRecurringTaskInstance(reopened, {
    id: 'task_launch_brief_2026_01_10',
    createdBy: owner.id,
    dueAt: '2026-01-10T17:00:00.000Z'
  });
  assert.equal(nextRecurring.title, reopened.title);
  assert.equal(nextRecurring.recurrence.sourceTaskId, reopened.id);
  assert.equal(nextRecurring.dueAt, '2026-01-10T17:00:00.000Z');
});

test('api exposes standalone task manager operations without integrations', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await requestJson(baseUrl, 'POST', '/api/workspaces', { id: 'workspace_demo', name: 'Demo Team' });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_demo/users', { id: 'user_owner', displayName: 'Owner' });
    await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_demo/users', { id: 'user_ops', displayName: 'Ops Lead' });

    const project = await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_demo/projects', {
      id: 'project_launch',
      name: 'Launch'
    });
    const list = await requestJson(baseUrl, 'POST', '/api/workspaces/workspace_demo/lists', {
      id: 'list_today',
      name: 'Today',
      projectId: project.id
    });

    const task = await requestJson(baseUrl, 'POST', '/api/tasks', {
      id: 'task_launch_brief',
      workspaceId: 'workspace_demo',
      title: 'Write launch brief',
      createdBy: 'user_owner',
      ownerId: 'user_ops',
      projectId: project.id,
      listId: list.id,
      tags: ['launch']
    });
    assert.equal(task.listId, list.id);

    const commented = await requestJson(baseUrl, 'POST', '/api/tasks/task_launch_brief/comments', {
      workspaceId: 'workspace_demo',
      authorId: 'user_owner',
      body: 'Keep the brief to one page.'
    });
    assert.equal(commented.comments.length, 1);

    const withSubtask = await requestJson(baseUrl, 'POST', '/api/tasks/task_launch_brief/subtasks', {
      workspaceId: 'workspace_demo',
      title: 'Draft outline',
      ownerId: 'user_ops'
    });
    assert.equal(withSubtask.subtasks.length, 1);

    const updated = await requestJson(
      baseUrl,
      'PATCH',
      `/api/tasks/task_launch_brief/subtasks/${withSubtask.subtasks[0].id}/status`,
      {
        workspaceId: 'workspace_demo',
        status: 'DONE',
        actorId: 'user_ops'
      }
    );
    assert.equal(updated.subtasks[0].status, 'DONE');

    await requestJson(baseUrl, 'PATCH', '/api/tasks/task_launch_brief', {
      workspaceId: 'workspace_demo',
      priority: 'HIGH',
      dueAt: '2026-01-03T17:00:00.000Z',
      notes: 'Use the approved positioning.'
    });

    const filtered = await requestJson(
      baseUrl,
      'GET',
      '/api/tasks?workspaceId=workspace_demo&query=brief&ownerId=user_ops&projectId=project_launch&listId=list_today&tag=launch'
    );
    assert.deepEqual(filtered.tasks.map((item) => item.id), ['task_launch_brief']);

    const archived = await requestJson(baseUrl, 'POST', '/api/tasks/task_launch_brief/archive', {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner'
    });
    assert.ok(archived.archivedAt);

    const activeOnly = await requestJson(baseUrl, 'GET', '/api/tasks?workspaceId=workspace_demo');
    assert.deepEqual(activeOnly.tasks, []);

    const reopened = await requestJson(baseUrl, 'POST', '/api/tasks/task_launch_brief/reopen', {
      workspaceId: 'workspace_demo',
      actorId: 'user_owner'
    });
    assert.equal(reopened.status, 'READY');

    const recurring = await requestJson(baseUrl, 'POST', '/api/tasks/task_launch_brief/recurring-instance', {
      workspaceId: 'workspace_demo',
      id: 'task_launch_brief_2026_01_10',
      createdBy: 'user_owner',
      dueAt: '2026-01-10T17:00:00.000Z'
    });
    assert.equal(recurring.recurrence.sourceTaskId, 'task_launch_brief');
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
