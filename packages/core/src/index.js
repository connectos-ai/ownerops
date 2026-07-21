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

export function createTask(input) {
  const now = new Date().toISOString();
  const title = cleanRequired(input.title, 'title');
  const workspaceId = cleanRequired(input.workspaceId, 'workspaceId');

  return {
    id: input.id || `task_${crypto.randomUUID()}`,
    workspaceId,
    title,
    description: cleanOptional(input.description),
    desiredOutcome: cleanOptional(input.desiredOutcome),
    sourceType: cleanOptional(input.sourceType || 'manual'),
    sourceReference: cleanOptional(input.sourceReference),
    sourceUrl: cleanOptional(input.sourceUrl),
    createdBy: cleanRequired(input.createdBy || 'system', 'createdBy'),
    ownerId: cleanOptional(input.ownerId || 'unassigned'),
    requestedBy: cleanOptional(input.requestedBy),
    collaborators: Array.isArray(input.collaborators) ? [...new Set(input.collaborators.map(String))] : [],
    status: normalizeStatus(input.status || TaskStatus.INBOX),
    priority: normalizePriority(input.priority || TaskPriority.NORMAL),
    dueAt: input.dueAt || null,
    startAt: input.startAt || null,
    completedAt: null,
    blockedReason: '',
    waitingOn: '',
    projectId: input.projectId || null,
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(String))] : [],
    ownerDecisionRequired: Boolean(input.ownerDecisionRequired),
    ownerDecisionReason: cleanOptional(input.ownerDecisionReason),
    confidence: Number.isFinite(input.confidence) ? input.confidence : null,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

export function changeTaskStatus(task, nextStatus, updates = {}) {
  const status = normalizeStatus(nextStatus);
  const now = new Date().toISOString();
  const next = { ...task, status, updatedAt: now, version: Number(task.version || 0) + 1 };

  if (status === TaskStatus.DONE) next.completedAt = now;
  if (status !== TaskStatus.DONE) next.completedAt = null;
  if (status === TaskStatus.BLOCKED) next.blockedReason = cleanRequired(updates.blockedReason, 'blockedReason');
  if (status === TaskStatus.WAITING) next.waitingOn = cleanRequired(updates.waitingOn, 'waitingOn');

  return next;
}

export function createEvent(type, payload) {
  if (!Object.values(EventType).includes(type)) throw new Error(`Unsupported event type: ${type}`);
  return {
    version: '2026-01-01',
    eventType: type,
    eventId: payload.eventId || `evt_${crypto.randomUUID()}`,
    workspaceId: cleanRequired(payload.workspaceId, 'workspaceId'),
    occurredAt: payload.occurredAt || new Date().toISOString(),
    actorId: cleanOptional(payload.actorId || 'system'),
    data: payload.data || {}
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

function cleanRequired(value, name) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function cleanOptional(value) {
  return String(value || '').trim();
}
