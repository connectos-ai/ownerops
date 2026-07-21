const workspaceStorageKey = 'ownerops.workspaceId';
const knownWorkspacesKey = 'ownerops.knownWorkspaces';
const defaultWorkspace = { id: 'workspace_local', name: 'My Workspace' };
const defaultUsers = [
  { id: 'user_owner', displayName: 'Owner' },
  { id: 'user_ops', displayName: 'Ops Lead' }
];
const columns = [
  ['INBOX', 'Inbox'],
  ['READY', 'Ready'],
  ['IN_PROGRESS', 'In Progress'],
  ['WAITING', 'Waiting'],
  ['BLOCKED', 'Blocked'],
  ['NEEDS_OWNER', 'Needs Owner'],
  ['DONE', 'Done']
];

let workspace = null;
let tasks = [];
let activeFilter = 'all';

const board = document.querySelector('#board-columns');
const taskForm = document.querySelector('#task-form');
const workspaceForm = document.querySelector('#workspace-form');
const memberForm = document.querySelector('#member-form');
const projectForm = document.querySelector('#project-form');
const listForm = document.querySelector('#list-form');
const template = document.querySelector('#task-card-template');
const searchInput = document.querySelector('#task-search');
const ownerSelect = document.querySelector('#task-owner');
const projectSelect = document.querySelector('#task-project');
const listSelect = document.querySelector('#task-list');
const workspaceSelect = document.querySelector('#workspace-select');

await loadWorkspace();
await refreshTasks();

workspaceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(workspaceForm);
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  const id = slugId('workspace', name);
  workspace = await api('/api/workspaces', { method: 'POST', body: { id, name } });
  await api(`/api/workspaces/${workspace.id}/users`, {
    method: 'POST',
    body: { id: 'user_owner', displayName: 'Owner' }
  });
  rememberWorkspace(workspace);
  workspaceForm.reset();
  await loadWorkspaceById(workspace.id);
});

memberForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(memberForm);
  const displayName = String(formData.get('displayName') || '').trim();
  if (!displayName) return;
  await api(`/api/workspaces/${workspace.id}/users`, {
    method: 'POST',
    body: { id: slugId('user', displayName), displayName }
  });
  memberForm.reset();
  await loadWorkspaceById(workspace.id);
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  await api(`/api/workspaces/${workspace.id}/projects`, {
    method: 'POST',
    body: { id: slugId('project', name), name }
  });
  projectForm.reset();
  await loadWorkspaceById(workspace.id);
});

listForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(listForm);
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  await api(`/api/workspaces/${workspace.id}/lists`, {
    method: 'POST',
    body: {
      id: slugId('list', name),
      name,
      projectId: projectSelect.value || undefined
    }
  });
  listForm.reset();
  await loadWorkspaceById(workspace.id);
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const title = String(formData.get('title') || '').trim();
  if (!title) return;

  await createTask({
    id: `task_${Date.now().toString(36)}`,
    workspaceId: workspace.id,
    title,
    description: String(formData.get('description') || '').trim(),
    createdBy: 'user_owner',
    ownerId: String(formData.get('ownerId') || 'unassigned'),
    priority: String(formData.get('priority') || 'NORMAL'),
    projectId: String(formData.get('projectId') || '') || undefined,
    listId: String(formData.get('listId') || '') || undefined,
    dueAt: dateToTimestamp(formData.get('dueAt'))
  });

  taskForm.reset();
  renderWorkspace();
  await refreshTasks();
});

document.querySelector('[data-refresh]').addEventListener('click', async () => {
  await loadWorkspaceById(workspace.id);
  await refreshTasks();
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((tab) => tab.classList.toggle('is-active', tab === button));
    render();
  });
});

searchInput.addEventListener('input', render);
workspaceSelect.addEventListener('change', async () => {
  await loadWorkspaceById(workspaceSelect.value);
  await refreshTasks();
});

async function loadWorkspace() {
  const savedId = localStorage.getItem(workspaceStorageKey) || defaultWorkspace.id;
  const savedWorkspace = readKnownWorkspaces().find((item) => item.id === savedId) || defaultWorkspace;
  workspace = await api('/api/workspaces', { method: 'POST', body: savedWorkspace });
  rememberWorkspace(workspace);
  if (workspace.users.length === 0) {
    for (const user of defaultUsers) {
      await api(`/api/workspaces/${workspace.id}/users`, { method: 'POST', body: user });
    }
  }
  await loadWorkspaceById(workspace.id);
}

async function loadWorkspaceById(workspaceId) {
  const knownWorkspace = readKnownWorkspaces().find((item) => item.id === workspaceId);
  workspace = knownWorkspace
    ? await api('/api/workspaces', { method: 'POST', body: knownWorkspace })
    : await api(`/api/workspaces/${workspaceId}`);
  rememberWorkspace(workspace);
  renderWorkspace();
}

function renderWorkspace() {
  document.querySelector('#workspace-current').textContent = workspace.name;
  document.querySelector('#workspace-counts').textContent =
    `${workspace.users.length} members · ${workspace.projects.length} projects · ${workspace.lists.length} lists`;
  renderSelect(workspaceSelect, readKnownWorkspaces().map((item) => [item.id, item.name]));
  workspaceSelect.value = workspace.id;
  renderSelect(ownerSelect, [
    ['unassigned', 'Unassigned'],
    ...workspace.users.map((user) => [user.id, user.displayName])
  ]);
  renderSelect(projectSelect, [
    ['', 'No project'],
    ...workspace.projects.map((project) => [project.id, project.name])
  ]);
  renderSelect(listSelect, [
    ['', 'No list'],
    ...workspace.lists.map((list) => [list.id, list.name])
  ]);
}

async function refreshTasks() {
  const response = await api(`/api/tasks?workspaceId=${workspace.id}&includeArchived=true`);
  tasks = response.tasks || [];
  render();
}

async function createTask(task) {
  return api('/api/tasks', { method: 'POST', body: task });
}

async function updateStatus(task, status) {
  await api(`/api/tasks/${task.id}/status`, {
    method: 'PATCH',
    body: {
      workspaceId: workspace.id,
      status,
      actorId: 'user_owner',
      waitingOn: status === 'WAITING' ? task.waitingOn || 'Waiting on reply' : undefined,
      blockedReason: status === 'BLOCKED' ? task.blockedReason || 'Blocked until next update' : undefined
    }
  });
  await refreshTasks();
}

async function archiveTask(task) {
  await api(`/api/tasks/${task.id}/archive`, {
    method: 'POST',
    body: { workspaceId: workspace.id, actorId: 'user_owner' }
  });
  await refreshTasks();
}

async function reopenTask(task) {
  await api(`/api/tasks/${task.id}/reopen`, {
    method: 'POST',
    body: { workspaceId: workspace.id, actorId: 'user_owner' }
  });
  await refreshTasks();
}

async function addTaskComment(task, body) {
  await api(`/api/tasks/${task.id}/comments`, {
    method: 'POST',
    body: { workspaceId: workspace.id, authorId: 'user_owner', body }
  });
  await refreshTasks();
}

async function addSubtask(task, title) {
  await api(`/api/tasks/${task.id}/subtasks`, {
    method: 'POST',
    body: { workspaceId: workspace.id, title, ownerId: task.ownerId || 'unassigned' }
  });
  await refreshTasks();
}

async function completeSubtask(task, subtask) {
  await api(`/api/tasks/${task.id}/subtasks/${subtask.id}/status`, {
    method: 'PATCH',
    body: { workspaceId: workspace.id, status: 'DONE', actorId: 'user_owner' }
  });
  await refreshTasks();
}

function render() {
  const visibleTasks = filterTasks(tasks);
  board.replaceChildren(...columns.map(([status, label]) => renderColumn(status, label, visibleTasks)));
  updateSummary(tasks);
}

function renderColumn(status, label, visibleTasks) {
  const column = document.createElement('section');
  column.className = 'board-column';
  column.setAttribute('aria-labelledby', `column-${status}`);

  const heading = document.createElement('div');
  heading.className = 'column-heading';
  const title = document.createElement('h3');
  title.id = `column-${status}`;
  title.textContent = label;
  const count = document.createElement('span');
  count.textContent = String(visibleTasks.filter((task) => task.status === status).length);
  heading.append(title, count);
  column.append(heading);

  const columnTasks = visibleTasks.filter((task) => task.status === status);
  if (columnTasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-column';
    empty.textContent = 'No tasks';
    column.append(empty);
    return column;
  }

  for (const task of columnTasks) {
    column.append(renderTaskCard(task));
  }

  return column;
}

function renderTaskCard(task) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.classList.toggle('is-archived', Boolean(task.archivedAt));
  card.querySelector('h3').textContent = task.title;
  card.querySelector('.priority').textContent = task.priority;
  card.querySelector('.task-description').textContent = task.description || task.desiredOutcome || 'No next action yet.';
  card.querySelector('.task-owner').textContent = displayName(task.ownerId);
  card.querySelector('.task-due').textContent = formatDate(task.dueAt);
  renderSubtasks(card, task);
  renderComments(card, task);
  card.querySelector('[data-form="subtask"]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.title;
    const title = String(input.value || '').trim();
    if (!title) return;
    input.value = '';
    await addSubtask(task, title);
  });
  card.querySelector('[data-form="comment"]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.body;
    const body = String(input.value || '').trim();
    if (!body) return;
    input.value = '';
    await addTaskComment(task, body);
  });
  card.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    if (action === 'ARCHIVE') {
      button.disabled = Boolean(task.archivedAt);
      button.addEventListener('click', () => archiveTask(task));
      return;
    }
    if (action === 'REOPEN') {
      button.disabled = !task.archivedAt;
      button.addEventListener('click', () => reopenTask(task));
      return;
    }
    button.disabled = Boolean(task.archivedAt) || task.status === action;
    button.addEventListener('click', () => updateStatus(task, action));
  });
  return card;
}

function renderSubtasks(card, task) {
  const list = card.querySelector('.subtask-list');
  list.replaceChildren(...(task.subtasks || []).map((subtask) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = subtask.status === 'DONE' ? 'Done' : 'Mark done';
    button.disabled = subtask.status === 'DONE' || Boolean(task.archivedAt);
    button.addEventListener('click', () => completeSubtask(task, subtask));
    const title = document.createElement('span');
    title.textContent = subtask.title;
    item.append(title, button);
    return item;
  }));
}

function renderComments(card, task) {
  const list = card.querySelector('.comment-list');
  const recent = (task.comments || []).slice(-3);
  list.replaceChildren(...recent.map((comment) => {
    const item = document.createElement('li');
    item.textContent = comment.body;
    return item;
  }));
}

function filterTasks(items) {
  const query = searchInput.value.trim().toLowerCase();
  return items.filter((task) => {
    if (activeFilter === 'archived') return Boolean(task.archivedAt);
    if (task.archivedAt) return false;
    if (activeFilter === 'today' && !isDueToday(task)) return false;
    if (activeFilter === 'waiting' && task.status !== 'WAITING') return false;
    if (activeFilter === 'blocked' && task.status !== 'BLOCKED') return false;
    if (activeFilter === 'owner' && task.status !== 'NEEDS_OWNER') return false;
    if (!query) return true;
    return [task.title, task.description, task.ownerId, displayName(task.ownerId), task.priority, task.projectId, task.listId, ...(task.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function updateSummary(items) {
  document.querySelector('#count-open').textContent = items.filter((task) => !['DONE', 'CANCELLED'].includes(task.status)).length;
  document.querySelector('#count-due').textContent = items.filter(isDueToday).length;
  document.querySelector('#count-blocked').textContent = items.filter((task) => task.status === 'BLOCKED').length;
  document.querySelector('#count-owner').textContent = items.filter((task) => task.status === 'NEEDS_OWNER').length;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(stripUndefined(options.body)) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `${options.method || 'GET'} ${path} failed`);
  }
  return data;
}

function renderSelect(select, options) {
  const current = select.value;
  select.replaceChildren(...options.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  if (options.some(([value]) => value === current)) {
    select.value = current;
  }
}

function rememberWorkspace(nextWorkspace) {
  localStorage.setItem(workspaceStorageKey, nextWorkspace.id);
  const known = new Map(readKnownWorkspaces().map((item) => [item.id, item]));
  known.set(nextWorkspace.id, { id: nextWorkspace.id, name: nextWorkspace.name });
  localStorage.setItem(knownWorkspacesKey, JSON.stringify([...known.values()]));
}

function readKnownWorkspaces() {
  try {
    return JSON.parse(localStorage.getItem(knownWorkspacesKey) || '[]');
  } catch {
    return [];
  }
}

function displayName(userId) {
  return workspace.users.find((user) => user.id === userId)?.displayName || userId || 'unassigned';
}

function slugId(prefix, value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `${prefix}_${slug || Date.now().toString(36)}`;
}

function stripUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function dateToTimestamp(value) {
  if (!value) return undefined;
  return new Date(`${value}T17:00:00.000Z`).toISOString();
}

function formatDate(value) {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function isDueToday(task) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  const now = new Date();
  return due.getUTCFullYear() === now.getUTCFullYear() && due.getUTCMonth() === now.getUTCMonth() && due.getUTCDate() === now.getUTCDate();
}
