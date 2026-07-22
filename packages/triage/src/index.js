import { TaskPriority, TaskStatus, createTask } from '../../core/src/index.js';

const WORK_PATTERNS = [
  /can you (take care|send|schedule|check|update|ask|make sure)/i,
  /please follow up/i,
  /we need to/i,
  /someone should/i,
  /don't let me forget/i,
  /done by/i,
  /waiting on/i,
  /blocking|blocked/i,
  /circle back/i,
  /we should decide/i
];

const OWNER_DECISION_PATTERNS = [
  /approve|approval/i,
  /authorize|authorization/i,
  /final decision/i,
  /budget|spend|contract/i,
  /legal|policy/i,
  /exception/i
];

export function classifyTextForWork(input) {
  const text = String(input.text || '').trim();
  const containsWork = WORK_PATTERNS.some((pattern) => pattern.test(text));
  const ownerDecisionRequired = OWNER_DECISION_PATTERNS.some((pattern) => pattern.test(text));
  const priority = /urgent|today|asap|blocked|blocking/i.test(text)
    ? TaskPriority.HIGH
    : TaskPriority.NORMAL;

  return {
    containsWork,
    recommendedAction: containsWork ? 'suggest_task' : 'reference_only',
    ownerDecisionRequired,
    priority,
    confidence: containsWork ? 0.72 : 0.42,
    explanation: containsWork
      ? 'The content includes language that appears to request follow-up work.'
      : 'No clear requested outcome was detected.'
  };
}

export function triageEmailToTaskSuggestion(email, options) {
  const workspaceId = cleanRequired(options?.workspaceId, 'workspaceId');
  const ownerId = cleanRequired(options?.defaultOwnerId, 'defaultOwnerId');
  const body = String(email.body || '');
  const subject = String(email.subject || 'Email follow-up').trim();
  const classification = classifyTextForWork({ text: `${subject}\n${body}` });
  const title = subject || firstSentence(body) || 'Email follow-up';

  return {
    id: `suggestion_${workspaceId}_${cleanRequired(email.id, 'email.id')}`,
    shouldBecomeTask: classification.containsWork,
    classification,
    source: {
      type: 'email',
      messageId: email.id,
      subject,
      receivedAt: email.receivedAt || null
    },
    task: createTask({
      id: `task_from_${email.id}`,
      workspaceId,
      title,
      description: body.slice(0, 2000),
      desiredOutcome: inferOutcome(body),
      sourceType: 'email',
      sourceReference: email.id,
      createdBy: 'triage',
      ownerId,
      status: classification.containsWork ? TaskStatus.READY : TaskStatus.INBOX,
      priority: classification.priority,
      ownerDecisionRequired: classification.ownerDecisionRequired,
      ownerDecisionReason: classification.ownerDecisionRequired ? 'The source appears to request approval or authorization.' : '',
      confidence: classification.confidence
    })
  };
}

export async function approveSuggestedTask(suggestion, taskDestination, options = {}) {
  if (!suggestion.shouldBecomeTask) throw new Error('Suggestion is not task-worthy');
  const task = {
    ...suggestion.task,
    approvedBy: cleanRequired(options.actorId || 'system', 'actorId'),
    approvedAt: new Date().toISOString()
  };
  return taskDestination.createTask(task);
}

export function rejectSuggestedTask(suggestion, options = {}) {
  const rejectedAt = new Date(options.rejectedAt || Date.now()).toISOString();
  return {
    ...suggestion,
    status: 'REJECTED',
    rejectedAt,
    rejectedBy: cleanRequired(options.actorId || 'system', 'actorId'),
    rejectionReason: cleanOptional(options.reason || 'Not actionable.'),
    updatedAt: rejectedAt
  };
}

function inferOutcome(text) {
  const sentence = firstSentence(text);
  return sentence ? `Requested outcome: ${sentence}` : 'Requested outcome is captured from the source message.';
}

function firstSentence(text) {
  return String(text || '').split(/[.!?]\s/)[0]?.trim().slice(0, 180) || '';
}

function cleanRequired(value, name) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function cleanOptional(value) {
  return String(value || '').trim();
}
