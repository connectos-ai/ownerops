const workspaceId = 'workspace_demo';
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

let tasks = [];
let activeFilter = 'all';

const board = document.querySelector('#board-columns');
const form = document.querySelector('#task-form');
const template = document.querySelector('#task-card-template');
const searchInput = document.querySelector('#task-search');

await ensureDemoWorkspace();
await refreshTasks();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const title = String(formData.get('title') || '').trim();
  if (!title) return;

  await createTask({
    id: `task_${Date.now().toString(36)}`,
    workspaceId,
    title,
    description: String(formData.get('description') || '').trim(),
    createdBy: 'user_owner',
    ownerId: String(formData.get('ownerId') || 'unassigned'),
    priority: String(formData.get('priority') || 'NORMAL'),
    dueAt: dateToTimestamp(formData.get('dueAt'))
  });

  form.reset();
  await refreshTasks();
});

document.querySelector('[data-refresh]').addEventListener('click', refreshTasks);

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((tab) => tab.classList.toggle('is-active', tab === button));
    render();
  });
});

searchInput.addEventListener('input', render);

async function ensureDemoWorkspace() {
  await ignoreConflict(api('/api/workspaces', {
    method: 'POST',
    body: { id: workspaceId, name: 'Demo Team' }
  }));

  for (const user of defaultUsers) {
    await ignoreConflict(api(`/api/workspaces/${workspaceId}/users`, {
      method: 'POST',
      body: user
    }));
  }
}

async function refreshTasks() {
  const response = await api(`/api/boards/kanban?workspaceId=${workspaceId}`);
  tasks = columns.flatMap(([status]) => response[status] || []);
  render();
}

async function createTask(task) {
  return api('/api/tasks', { method: 'POST', body: task });
}

async function updateStatus(task, status) {
  await api(`/api/tasks/${task.id}/status`, {
    method: 'PATCH',
    body: {
      workspaceId,
      status,
      actorId: 'user_owner',
      waitingOn: status === 'WAITING' ? task.waitingOn || 'Waiting on reply' : undefined,
      blockedReason: status === 'BLOCKED' ? task.blockedReason || 'Blocked until next update' : undefined
    }
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
  card.querySelector('h3').textContent = task.title;
  card.querySelector('.priority').textContent = task.priority;
  card.querySelector('.task-description').textContent = task.description || task.desiredOutcome || 'No next action yet.';
  card.querySelector('.task-owner').textContent = task.ownerId || 'unassigned';
  card.querySelector('.task-due').textContent = formatDate(task.dueAt);
  card.querySelectorAll('[data-action]').forEach((button) => {
    const status = button.dataset.action;
    button.disabled = task.status === status;
    button.addEventListener('click', () => updateStatus(task, status));
  });
  return card;
}

function filterTasks(items) {
  const query = searchInput.value.trim().toLowerCase();
  return items.filter((task) => {
    if (activeFilter === 'today' && !isDueToday(task)) return false;
    if (activeFilter === 'waiting' && task.status !== 'WAITING') return false;
    if (activeFilter === 'blocked' && task.status !== 'BLOCKED') return false;
    if (activeFilter === 'owner' && task.status !== 'NEEDS_OWNER') return false;
    if (!query) return true;
    return [task.title, task.description, task.ownerId, task.priority, ...(task.tags || [])]
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

async function ignoreConflict(promise) {
  try {
    return await promise;
  } catch (error) {
    if (!/already exists|duplicate/i.test(error.message)) throw error;
    return null;
  }
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
