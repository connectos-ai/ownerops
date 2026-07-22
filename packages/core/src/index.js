import { createHash, randomUUID } from 'node:crypto';

export const TaskStatus = Object.freeze({
  INBOX: 'INBOX',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING: 'WAITING',
  BLOCKED: 'BLOCKED',
  NEEDS_OWNER: 'NEEDS_OWNER',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED'
});

export const TaskPriority = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW'
});

export const WorkspaceUserRole = Object.freeze({
  ADMIN: 'admin',
  MEMBER: 'member',
  GUEST: 'guest'
});

export const WorkspaceUserStatus = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  DEACTIVATED: 'deactivated'
});

export const EventType = Object.freeze({
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_ASSIGNED: 'task.assigned',
  TASK_REASSIGNED: 'task.reassigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_BLOCKED: 'task.blocked',
  TASK_WAITING: 'task.waiting',
  TASK_COMPLETED: 'task.completed',
  TASK_REOPENED: 'task.reopened',
  TASK_CANCELLED: 'task.cancelled',
  TASK_ARCHIVED: 'task.archived',
  TASK_OVERDUE: 'task.overdue',
  TASK_COMMENT_ADDED: 'task.comment_added',
  TASK_SUBTASK_ADDED: 'task.subtask_added',
  TASK_SUBTASK_STATUS_CHANGED: 'task.subtask_status_changed',
  OWNER_DECISION_REQUESTED: 'task.owner_decision_requested',
  OWNER_DECISION_RESOLVED: 'task.owner_decision_resolved',
  TRIAGE_ITEM_RECEIVED: 'triage.item_received',
  TRIAGE_WORK_DETECTED: 'triage.work_detected',
  TRIAGE_TASK_SUGGESTED: 'triage.task_suggested',
  TRIAGE_TASK_APPROVED: 'triage.task_approved',
  TRIAGE_TASK_REJECTED: 'triage.task_rejected',
  BRIEF_GENERATED: 'brief.generated'
});

export function createWorkspace(input) {
  const now = timestamp(input?.createdAt);
  return {
    id: cleanRequired(input?.id || `workspace_${randomUUID()}`, 'id'),
    name: cleanRequired(input?.name, 'name'),
    users: [],
    projects: [],
    lists: [],
    policies: input?.policies || {},
    createdAt: now,
    updatedAt: now
  };
}

export function addWorkspaceUser(workspace, input) {
  const now = timestamp(input?.createdAt);
  const user = {
    id: cleanRequired(input?.id || `user_${randomUUID()}`, 'id'),
    displayName: cleanRequired(input?.displayName, 'displayName'),
    role: normalizeWorkspaceUserRole(input?.role),
    status: normalizeWorkspaceUserStatus(input?.status),
    slackUserId: cleanOptional(input?.slackUserId),
    emailHash: normalizeEmailHash(input),
    externalIds: normalizeExternalIds(input?.externalIds),
    invitedAt: input?.status === WorkspaceUserStatus.INVITED ? timestamp(input?.invitedAt || now) : normalizeNullableTimestamp(input?.invitedAt),
    deactivatedAt: normalizeNullableTimestamp(input?.deactivatedAt),
    createdAt: now,
    updatedAt: now
  };
  workspace.users.push(user);
  workspace.updatedAt = timestamp();
  return user;
}

export function updateWorkspaceUser(workspace, userId, updates = {}) {
  const id = cleanRequired(userId, 'userId');
  const index = workspace.users.findIndex((user) => user.id === id);
  if (index === -1) throw new Error(`Workspace user not found: ${id}`);
  const existing = workspace.users[index];
  const next = {
    ...existing,
    updatedAt: timestamp()
  };
  if ('displayName' in updates) next.displayName = cleanRequired(updates.displayName, 'displayName');
  if ('role' in updates) next.role = normalizeWorkspaceUserRole(updates.role);
  if ('status' in updates) {
    next.status = normalizeWorkspaceUserStatus(updates.status);
    if (next.status === WorkspaceUserStatus.INVITED && !next.invitedAt) next.invitedAt = timestamp();
    if (next.status === WorkspaceUserStatus.DEACTIVATED) next.deactivatedAt = timestamp(updates.deactivatedAt);
    if (next.status !== WorkspaceUserStatus.DEACTIVATED) next.deactivatedAt = null;
  }
  if ('slackUserId' in updates) next.slackUserId = cleanOptional(updates.slackUserId);
  if ('email' in updates || 'emailHash' in updates) next.emailHash = normalizeEmailHash(updates);
  if ('externalIds' in updates) {
    next.externalIds = normalizeExternalIds({ ...(next.externalIds || {}), ...(updates.externalIds || {}) });
  }
  workspace.users[index] = next;
  workspace.updatedAt = timestamp();
  return next;
}

export function deactivateWorkspaceUser(workspace, userId, input = {}) {
  return updateWorkspaceUser(workspace, userId, {
    ...input,
    status: WorkspaceUserStatus.DEACTIVATED,
    deactivatedAt: timestamp(input.deactivatedAt)
  });
}

export function createProject(workspace, input) {
  const now = timestamp(input?.createdAt);
  const project = {
    id: cleanRequired(input?.id || `project_${randomUUID()}`, 'id'),
    workspaceId: workspace.id,
    name: cleanRequired(input?.name, 'name'),
    description: cleanOptional(input?.description),
    ownerId: cleanOptional(input?.ownerId || 'unassigned'),
    status: cleanOptional(input?.status || 'active'),
    tags: normalizeStringList(input?.tags),
    createdAt: now,
    updatedAt: now
  };
  workspace.projects.push(project);
  workspace.updatedAt = timestamp();
  return project;
}

export function createTaskList(workspace, input) {
  const now = timestamp(input?.createdAt);
  const list = {
    id: cleanRequired(input?.id || `list_${randomUUID()}`, 'id'),
    workspaceId: workspace.id,
    projectId: cleanOptional(input?.projectId) || null,
    name: cleanRequired(input?.name, 'name'),
    description: cleanOptional(input?.description),
    sortOrder: Number.isFinite(input?.sortOrder) ? input.sortOrder : workspace.lists.length,
    createdAt: now,
    updatedAt: now
  };
  workspace.lists.push(list);
  workspace.updatedAt = timestamp();
  return list;
}

export function createTask(input) {
  const now = timestamp(input?.createdAt);
  const task = {
    id: cleanRequired(input?.id || `task_${randomUUID()}`, 'id'),
    workspaceId: cleanRequired(input?.workspaceId, 'workspaceId'),
    title: cleanRequired(input?.title, 'title'),
    description: cleanOptional(input?.description),
    desiredOutcome: cleanOptional(input?.desiredOutcome),
    notes: cleanOptional(input?.notes),
    sourceType: cleanOptional(input?.sourceType || 'manual'),
    sourceReference: cleanOptional(input?.sourceReference),
    sourceUrl: cleanOptional(input?.sourceUrl),
    createdBy: cleanRequired(input?.createdBy || 'system', 'createdBy'),
    ownerId: cleanOptional(input?.ownerId || 'unassigned'),
    requestedBy: cleanOptional(input?.requestedBy),
    collaborators: normalizeStringList(input?.collaborators),
    status: normalizeStatus(input?.status || TaskStatus.INBOX),
    priority: normalizePriority(input?.priority || TaskPriority.NORMAL),
    dueAt: normalizeNullableTimestamp(input?.dueAt),
    startAt: normalizeNullableTimestamp(input?.startAt),
    completedAt: normalizeNullableTimestamp(input?.completedAt),
    blockedReason: cleanOptional(input?.blockedReason),
    waitingOn: cleanOptional(input?.waitingOn),
    projectId: cleanOptional(input?.projectId) || null,
    listId: cleanOptional(input?.listId) || null,
    parentTaskId: cleanOptional(input?.parentTaskId) || null,
    tags: normalizeStringList(input?.tags),
    ownerDecisionRequired: Boolean(input?.ownerDecisionRequired),
    ownerDecisionReason: cleanOptional(input?.ownerDecisionReason),
    confidence: Number.isFinite(input?.confidence) ? input.confidence : null,
    recurrence: normalizeRecurrence(input?.recurrence),
    archivedAt: normalizeNullableTimestamp(input?.archivedAt),
    history: [],
    comments: normalizeComments(input?.comments),
    subtasks: normalizeSubtasks(input?.subtasks),
    createdAt: now,
    updatedAt: now,
    version: Number(input?.version || 1)
  };
  return appendHistory(task, EventType.TASK_CREATED, { actorId: task.createdBy });
}

export function assignTask(task, ownerId, options = {}) {
  const nextOwnerId = cleanRequired(ownerId, 'ownerId');
  const eventType = task.ownerId && task.ownerId !== 'unassigned'
    ? EventType.TASK_REASSIGNED
    : EventType.TASK_ASSIGNED;
  return appendHistory(touch({ ...task, ownerId: nextOwnerId }), eventType, {
    actorId: options.actorId || 'system',
    previousOwnerId: task.ownerId || 'unassigned',
    nextOwnerId
  });
}

export function addCollaborator(task, collaboratorId, options = {}) {
  const id = cleanRequired(collaboratorId, 'collaboratorId');
  const collaborators = task.collaborators.includes(id)
    ? task.collaborators
    : [...task.collaborators, id];
  return appendHistory(
    touch({ ...task, collaborators }),
    EventType.TASK_UPDATED,
    { actorId: options.actorId || 'system', change: 'collaborator_added', collaboratorId: id }
  );
}

export function updateTaskDetails(task, updates = {}) {
  const next = { ...task };
  if ('title' in updates) next.title = cleanRequired(updates.title, 'title');
  if ('description' in updates) next.description = cleanOptional(updates.description);
  if ('desiredOutcome' in updates) next.desiredOutcome = cleanOptional(updates.desiredOutcome);
  if ('notes' in updates) next.notes = cleanOptional(updates.notes);
  if ('priority' in updates) next.priority = normalizePriority(updates.priority);
  if ('dueAt' in updates) next.dueAt = normalizeNullableTimestamp(updates.dueAt);
  if ('startAt' in updates) next.startAt = normalizeNullableTimestamp(updates.startAt);
  if ('projectId' in updates) next.projectId = cleanOptional(updates.projectId) || null;
  if ('listId' in updates) next.listId = cleanOptional(updates.listId) || null;
  if ('tags' in updates) next.tags = normalizeStringList(updates.tags);
  if ('sourceUrl' in updates) next.sourceUrl = cleanOptional(updates.sourceUrl);
  if ('sourceReference' in updates) next.sourceReference = cleanOptional(updates.sourceReference);
  return appendHistory(touch(next), EventType.TASK_UPDATED, {
    actorId: updates.actorId || 'system',
    change: 'details_updated'
  });
}

export function addTaskComment(task, input) {
  const now = timestamp(input?.createdAt);
  const comment = {
    id: cleanRequired(input?.id || `comment_${randomUUID()}`, 'id'),
    authorId: cleanRequired(input?.authorId || 'system', 'authorId'),
    body: cleanRequired(input?.body, 'body'),
    createdAt: now,
    updatedAt: now
  };
  return appendHistory(
    touch({ ...task, comments: [...(task.comments || []), comment] }),
    EventType.TASK_COMMENT_ADDED,
    { actorId: comment.authorId, commentId: comment.id }
  );
}

export function addSubtask(task, input) {
  const now = timestamp(input?.createdAt);
  const subtask = {
    id: cleanRequired(input?.id || `subtask_${randomUUID()}`, 'id'),
    title: cleanRequired(input?.title, 'title'),
    ownerId: cleanOptional(input?.ownerId || task.ownerId || 'unassigned'),
    status: normalizeStatus(input?.status || TaskStatus.INBOX),
    dueAt: normalizeNullableTimestamp(input?.dueAt),
    completedAt: normalizeNullableTimestamp(input?.completedAt),
    createdAt: now,
    updatedAt: now
  };
  return appendHistory(
    touch({ ...task, subtasks: [...(task.subtasks || []), subtask] }),
    EventType.TASK_SUBTASK_ADDED,
    { actorId: input?.actorId || 'system', subtaskId: subtask.id }
  );
}

export function changeSubtaskStatus(task, subtaskId, nextStatus, updates = {}) {
  const status = normalizeStatus(nextStatus);
  let found = false;
  const subtasks = (task.subtasks || []).map((subtask) => {
    if (subtask.id !== subtaskId) return subtask;
    found = true;
    return {
      ...subtask,
      status,
      completedAt: status === TaskStatus.DONE ? timestamp(updates.completedAt) : null,
      updatedAt: timestamp()
    };
  });
  if (!found) throw new Error(`Subtask not found: ${subtaskId}`);
  return appendHistory(
    touch({ ...task, subtasks }),
    EventType.TASK_SUBTASK_STATUS_CHANGED,
    { actorId: updates.actorId || 'system', subtaskId, nextStatus: status }
  );
}

export function changeTaskStatus(task, nextStatus, updates = {}) {
  const status = normalizeStatus(nextStatus);
  const next = touch({ ...task, status });
  if (status === TaskStatus.DONE) next.completedAt = timestamp(updates.completedAt);
  if (status !== TaskStatus.DONE) next.completedAt = null;
  if (status === TaskStatus.BLOCKED) next.blockedReason = cleanRequired(updates.blockedReason, 'blockedReason');
  if (status !== TaskStatus.BLOCKED && updates.clearBlockedReason !== false) next.blockedReason = '';
  if (status === TaskStatus.WAITING) next.waitingOn = cleanRequired(updates.waitingOn, 'waitingOn');
  if (status !== TaskStatus.WAITING && updates.clearWaitingOn !== false) next.waitingOn = '';
  const eventType = status === TaskStatus.DONE
    ? EventType.TASK_COMPLETED
    : status === TaskStatus.BLOCKED
      ? EventType.TASK_BLOCKED
      : status === TaskStatus.WAITING
        ? EventType.TASK_WAITING
        : status === TaskStatus.IN_PROGRESS && task.status === TaskStatus.DONE
          ? EventType.TASK_REOPENED
          : status === TaskStatus.CANCELLED
            ? EventType.TASK_CANCELLED
            : EventType.TASK_STATUS_CHANGED;
  return appendHistory(next, eventType, {
    actorId: updates.actorId || 'system',
    previousStatus: task.status,
    nextStatus: status
  });
}

export function archiveTask(task, input = {}) {
  return appendHistory(
    touch({ ...task, archivedAt: timestamp(input.archivedAt) }),
    EventType.TASK_ARCHIVED,
    { actorId: input.actorId || 'system' }
  );
}

export function reopenTask(task, input = {}) {
  const status = input.status ? normalizeStatus(input.status) : TaskStatus.READY;
  return appendHistory(
    touch({ ...task, status, completedAt: null, archivedAt: null }),
    EventType.TASK_REOPENED,
    { actorId: input.actorId || 'system', previousStatus: task.status, nextStatus: status }
  );
}

export function requestOwnerDecision(task, input) {
  const reason = cleanRequired(input?.reason, 'reason');
  const next = touch({
    ...task,
    status: TaskStatus.NEEDS_OWNER,
    ownerDecisionRequired: true,
    ownerDecisionReason: reason,
    ownerDecision: {
      reason,
      recommendedChoice: cleanOptional(input?.recommendedChoice),
      alternatives: normalizeStringList(input?.alternatives),
      requestedAt: timestamp(input?.requestedAt),
      resolvedAt: null
    }
  });
  return appendHistory(next, EventType.OWNER_DECISION_REQUESTED, {
    actorId: input?.actorId || 'system',
    reason
  });
}

export function resolveOwnerDecision(task, input) {
  const decision = cleanRequired(input?.decision, 'decision');
  const next = touch({
    ...task,
    status: input?.nextStatus ? normalizeStatus(input.nextStatus) : TaskStatus.READY,
    ownerDecisionRequired: false,
    ownerDecisionReason: '',
    ownerDecision: {
      ...(task.ownerDecision || {}),
      decision,
      resolvedAt: timestamp(input?.resolvedAt)
    }
  });
  return appendHistory(next, EventType.OWNER_DECISION_RESOLVED, {
    actorId: input?.actorId || 'system',
    decision
  });
}

export function createRecurringTaskInstance(task, input = {}) {
  return createTask({
    ...task,
    id: cleanRequired(input.id || `task_${randomUUID()}`, 'id'),
    createdBy: cleanRequired(input.createdBy || task.ownerId || 'system', 'createdBy'),
    status: input.status || TaskStatus.INBOX,
    dueAt: input.dueAt || null,
    startAt: input.startAt || null,
    completedAt: null,
    archivedAt: null,
    sourceType: 'recurring_task',
    sourceReference: `${task.id}:${input.dueAt || input.id || new Date().toISOString()}`,
    comments: [],
    subtasks: (task.subtasks || []).map((subtask) => ({
      ...subtask,
      id: `subtask_${randomUUID()}`,
      status: TaskStatus.INBOX,
      completedAt: null,
      createdAt: timestamp(),
      updatedAt: timestamp()
    })),
    recurrence: {
      ...(task.recurrence || {}),
      sourceTaskId: task.id,
      rule: cleanOptional(input.rule || task.recurrence?.rule),
      generatedAt: timestamp(input.generatedAt)
    },
    history: [],
    version: 1
  });
}

export function groupTasksForKanban(tasks) {
  const board = Object.fromEntries(Object.values(TaskStatus).map((status) => [status, []]));
  for (const task of tasks) {
    if (task.archivedAt) continue;
    const status = normalizeStatus(task.status || TaskStatus.INBOX);
    board[status].push(task);
  }
  return board;
}

export function searchTasks(tasks, filters = {}) {
  const query = cleanOptional(filters.query || filters.q).toLowerCase();
  const statuses = normalizeFilterList(filters.status || filters.statuses).map(normalizeStatus);
  const tag = cleanOptional(filters.tag).toLowerCase();
  const includeArchived = Boolean(filters.includeArchived);
  return tasks.filter((task) => {
    if (filters.workspaceId && task.workspaceId !== filters.workspaceId) return false;
    if (!includeArchived && task.archivedAt) return false;
    if (filters.ownerId && task.ownerId !== filters.ownerId) return false;
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    if (filters.listId && task.listId !== filters.listId) return false;
    if (statuses.length && !statuses.includes(task.status)) return false;
    if (tag && !(task.tags || []).map((item) => item.toLowerCase()).includes(tag)) return false;
    if (filters.dueBefore && (!task.dueAt || task.dueAt > timestamp(filters.dueBefore))) return false;
    if (filters.dueAfter && (!task.dueAt || task.dueAt < timestamp(filters.dueAfter))) return false;
    if (!query) return true;
    return [
      task.title,
      task.description,
      task.desiredOutcome,
      task.notes,
      task.blockedReason,
      task.waitingOn,
      ...(task.tags || []),
      ...(task.comments || []).map((comment) => comment.body),
      ...(task.subtasks || []).map((subtask) => subtask.title)
    ].some((value) => cleanOptional(value).toLowerCase().includes(query));
  });
}

export function generateDailyBrief(tasks, options = {}) {
  const today = dateOnly(options.now || new Date().toISOString());
  const active = tasks.filter((task) => ![TaskStatus.CANCELLED].includes(task.status) && !task.archivedAt);
  return {
    generatedAt: timestamp(options.now),
    dueToday: active.filter((task) => task.dueAt && dateOnly(task.dueAt) === today && task.status !== TaskStatus.DONE),
    overdue: active.filter((task) => task.dueAt && dateOnly(task.dueAt) < today && task.status !== TaskStatus.DONE),
    blocked: active.filter((task) => task.status === TaskStatus.BLOCKED),
    waiting: active.filter((task) => task.status === TaskStatus.WAITING),
    needsOwner: active.filter((task) => task.status === TaskStatus.NEEDS_OWNER || task.ownerDecisionRequired),
    completed: active.filter((task) => task.status === TaskStatus.DONE),
    recommendedNextMove: recommendedNextMove(active)
  };
}

export function generateWeeklyReview(tasks) {
  const active = tasks.filter((task) => !task.archivedAt);
  const completed = active.filter((task) => task.status === TaskStatus.DONE);
  const carriedForward = active.filter((task) => ![TaskStatus.DONE, TaskStatus.CANCELLED].includes(task.status));
  const blocked = active.filter((task) => task.status === TaskStatus.BLOCKED);
  const needsOwner = active.filter((task) => task.status === TaskStatus.NEEDS_OWNER || task.ownerDecisionRequired);
  return {
    completed,
    carriedForward,
    repeatedBlockers: blocked,
    agingTasks: carriedForward.filter((task) => task.dueAt),
    ownerBottlenecks: needsOwner,
    delegationOpportunities: carriedForward.filter((task) => task.ownerId === 'unassigned'),
    workloadByOwner: countBy(carriedForward, 'ownerId'),
    decisionsAwaitingAction: needsOwner,
    suggestedImprovements: buildWeeklyImprovements({ blocked, needsOwner, carriedForward })
  };
}

export function createEvent(type, payload) {
  if (!Object.values(EventType).includes(type)) throw new Error(`Unsupported event type: ${type}`);
  return {
    version: '2026-01-01',
    eventType: type,
    eventId: payload.eventId || `evt_${randomUUID()}`,
    workspaceId: cleanRequired(payload.workspaceId, 'workspaceId'),
    occurredAt: payload.occurredAt || new Date().toISOString(),
    actorId: cleanOptional(payload.actorId || 'system'),
    data: payload.data || {}
  };
}

function appendHistory(task, eventType, data = {}) {
  const event = createEvent(eventType, {
    workspaceId: task.workspaceId,
    actorId: data.actorId || 'system',
    data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'actorId'))
  });
  return { ...task, history: [...(task.history || []), event] };
}

function touch(task) {
  return { ...task, updatedAt: timestamp(), version: Number(task.version || 1) + 1 };
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (!Object.values(TaskStatus).includes(status)) throw new Error(`Unsupported task status: ${value}`);
  return status;
}

function normalizePriority(value) {
  const priority = String(value || '').trim().toUpperCase();
  if (!Object.values(TaskPriority).includes(priority)) throw new Error(`Unsupported task priority: ${value}`);
  return priority;
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
}

function normalizeFilterList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeComments(value) {
  return Array.isArray(value)
    ? value.map((comment) => ({
      id: cleanRequired(comment.id || `comment_${randomUUID()}`, 'id'),
      authorId: cleanRequired(comment.authorId || 'system', 'authorId'),
      body: cleanRequired(comment.body, 'body'),
      createdAt: timestamp(comment.createdAt),
      updatedAt: timestamp(comment.updatedAt || comment.createdAt)
    }))
    : [];
}

function normalizeSubtasks(value) {
  return Array.isArray(value)
    ? value.map((subtask) => ({
      id: cleanRequired(subtask.id || `subtask_${randomUUID()}`, 'id'),
      title: cleanRequired(subtask.title, 'title'),
      ownerId: cleanOptional(subtask.ownerId || 'unassigned'),
      status: normalizeStatus(subtask.status || TaskStatus.INBOX),
      dueAt: normalizeNullableTimestamp(subtask.dueAt),
      completedAt: normalizeNullableTimestamp(subtask.completedAt),
      createdAt: timestamp(subtask.createdAt),
      updatedAt: timestamp(subtask.updatedAt || subtask.createdAt)
    }))
    : [];
}

function normalizeRecurrence(value) {
  if (!value) return null;
  return {
    rule: cleanOptional(value.rule),
    sourceTaskId: cleanOptional(value.sourceTaskId),
    generatedAt: value.generatedAt ? timestamp(value.generatedAt) : null
  };
}

function normalizeWorkspaceUserRole(value) {
  const role = cleanOptional(value || WorkspaceUserRole.MEMBER).toLowerCase();
  if (!Object.values(WorkspaceUserRole).includes(role)) {
    throw new Error(`Invalid workspace user role: ${value}`);
  }
  return role;
}

function normalizeWorkspaceUserStatus(value) {
  const status = cleanOptional(value || WorkspaceUserStatus.ACTIVE).toLowerCase();
  if (!Object.values(WorkspaceUserStatus).includes(status)) {
    throw new Error(`Invalid workspace user status: ${value}`);
  }
  return status;
}

function normalizeEmailHash(input = {}) {
  if (input.emailHash) return cleanOptional(input.emailHash);
  const email = cleanOptional(input.email).toLowerCase();
  if (!email) return '';
  return createHash('sha256').update(email).digest('hex');
}

function normalizeExternalIds(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {})
      .map(([key, externalId]) => [cleanOptional(key), cleanOptional(externalId)])
      .filter(([key, externalId]) => key && externalId)
  );
}

function cleanRequired(value, name) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} required`);
  return text;
}

function cleanOptional(value) {
  return String(value || '').trim();
}

function normalizeNullableTimestamp(value) {
  return value ? timestamp(value) : null;
}

function timestamp(value) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || 'unassigned';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function recommendedNextMove(tasks) {
  if (tasks.some((task) => task.status === TaskStatus.NEEDS_OWNER || task.ownerDecisionRequired)) {
    return 'Resolve owner decisions blocking work.';
  }
  if (tasks.some((task) => task.status === TaskStatus.BLOCKED)) {
    return 'Unblock highest-priority blocked task.';
  }
  return 'Review today tasks confirm each one accountable owner.';
}

function buildWeeklyImprovements({ blocked, needsOwner, carriedForward }) {
  const improvements = [];
  if (blocked.length) improvements.push('Review repeated blockers decide who remove each constraint.');
  if (needsOwner.length) improvements.push('Reduce owner bottlenecks by resolving or delegating pending decisions.');
  if (carriedForward.some((task) => task.ownerId === 'unassigned')) {
    improvements.push('Assign unowned work before next operating week starts.');
  }
  return improvements;
}
