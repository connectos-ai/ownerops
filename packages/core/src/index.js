import { randomUUID } from 'node:crypto';

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
  TASK_OVERDUE: 'task.overdue',
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
    createdAt: now,
    updatedAt: now
  };
}

export function addWorkspaceUser(workspace, input) {
  const user = {
    id: cleanRequired(input?.id || `user_${randomUUID()}`, 'id'),
    displayName: cleanRequired(input?.displayName, 'displayName'),
    role: cleanOptional(input?.role || 'member'),
    slackUserId: cleanOptional(input?.slackUserId),
    email: cleanOptional(input?.email),
    isActive: input?.isActive !== false
  };
  if (!workspace.users.some((existing) => existing.id === user.id)) workspace.users.push(user);
  return user;
}

export function createTask(input) {
  const now = timestamp(input?.createdAt);
  const task = {
    id: cleanRequired(input?.id || `task_${randomUUID()}`, 'id'),
    workspaceId: cleanRequired(input?.workspaceId, 'workspaceId'),
    title: cleanRequired(input?.title, 'title'),
    description: cleanOptional(input?.description),
    desiredOutcome: cleanOptional(input?.desiredOutcome),
    sourceType: cleanOptional(input?.sourceType || 'manual'),
    sourceReference: cleanOptional(input?.sourceReference),
    sourceUrl: cleanOptional(input?.sourceUrl),
    createdBy: cleanRequired(input?.createdBy || 'system', 'createdBy'),
    ownerId: cleanOptional(input?.ownerId || 'unassigned'),
    requestedBy: cleanOptional(input?.requestedBy),
    collaborators: normalizeStringList(input?.collaborators),
    status: normalizeStatus(input?.status || TaskStatus.INBOX),
    priority: normalizePriority(input?.priority || TaskPriority.NORMAL),
    dueAt: input?.dueAt || null,
    startAt: input?.startAt || null,
    completedAt: input?.completedAt || null,
    blockedReason: cleanOptional(input?.blockedReason),
    waitingOn: cleanOptional(input?.waitingOn),
    projectId: input?.projectId || null,
    tags: normalizeStringList(input?.tags),
    ownerDecisionRequired: Boolean(input?.ownerDecisionRequired),
    ownerDecisionReason: cleanOptional(input?.ownerDecisionReason),
    confidence: Number.isFinite(input?.confidence) ? input.confidence : null,
    history: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
    version: Number(input?.version || 1)
  };
  return appendHistory(task, EventType.TASK_CREATED, { actorId: task.createdBy });
}

export function assignTask(task, ownerId, options = {}) {
  const nextOwnerId = cleanRequired(ownerId, 'ownerId');
  const eventType = task.ownerId && task.ownerId !== 'unassigned' ? EventType.TASK_REASSIGNED : EventType.TASK_ASSIGNED;
  return appendHistory(
    touch({ ...task, ownerId: nextOwnerId }),
    eventType,
    { actorId: options.actorId || 'system', previousOwnerId: task.ownerId, ownerId: nextOwnerId }
  );
}

export function addCollaborator(task, collaboratorId, options = {}) {
  const id = cleanRequired(collaboratorId, 'collaboratorId');
  const collaborators = task.collaborators.includes(id) ? task.collaborators : [...task.collaborators, id];
  return appendHistory(
    touch({ ...task, collaborators }),
    EventType.TASK_UPDATED,
    { actorId: options.actorId || 'system', change: 'collaborator_added', collaboratorId: id }
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
      resolvedAt: null,
      decision: ''
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

export function groupTasksForKanban(tasks) {
  const board = Object.fromEntries(Object.values(TaskStatus).map((status) => [status, []]));
  for (const task of tasks) {
    const status = normalizeStatus(task.status || TaskStatus.INBOX);
    board[status].push(task);
  }
  return board;
}

export function generateDailyBrief(tasks, options = {}) {
  const today = dateOnly(options.now || new Date().toISOString());
  const active = tasks.filter((task) => ![TaskStatus.CANCELLED].includes(task.status));
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
  const completed = tasks.filter((task) => task.status === TaskStatus.DONE);
  const carriedForward = tasks.filter((task) => ![TaskStatus.DONE, TaskStatus.CANCELLED].includes(task.status));
  const blocked = tasks.filter((task) => task.status === TaskStatus.BLOCKED);
  const needsOwner = tasks.filter((task) => task.status === TaskStatus.NEEDS_OWNER || task.ownerDecisionRequired);
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
  return {
    ...task,
    history: [...(task.history || []), event]
  };
}

function touch(task) {
  return {
    ...task,
    updatedAt: new Date().toISOString(),
    version: Number(task.version || 0) + 1
  };
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

function cleanRequired(value, name) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function cleanOptional(value) {
  return String(value || '').trim();
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
    return 'Resolve the owner decisions blocking work.';
  }
  if (tasks.some((task) => task.status === TaskStatus.BLOCKED)) {
    return 'Unblock the highest-priority blocked task.';
  }
  return 'Review today tasks and confirm each has one accountable owner.';
}

function buildWeeklyImprovements({ blocked, needsOwner, carriedForward }) {
  const improvements = [];
  if (blocked.length) improvements.push('Review repeated blockers and decide who can remove each constraint.');
  if (needsOwner.length) improvements.push('Reduce owner bottlenecks by resolving or delegating pending decisions.');
  if (carriedForward.some((task) => task.ownerId === 'unassigned')) improvements.push('Assign unowned work before the next operating week starts.');
  return improvements;
}
