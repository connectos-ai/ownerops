import { TaskPriority, TaskStatus, createTask } from '../../core/src/index.js';

const WORK_PATTERNS = [
  { pattern: /can you (take care|send|schedule|check|update|ask|make sure)/i, label: 'direct request' },
  { pattern: /please follow up/i, label: 'follow-up request' },
  { pattern: /we need to/i, label: 'needed work' },
  { pattern: /someone should/i, label: 'unassigned work' },
  { pattern: /don't let me forget/i, label: 'reminder request' },
  { pattern: /done by/i, label: 'deadline request' },
  { pattern: /waiting on/i, label: 'waiting state' },
  { pattern: /blocking|blocked/i, label: 'blocked work' },
  { pattern: /circle back/i, label: 'follow-up request' },
  { pattern: /we should decide/i, label: 'decision request' }
];

const OWNER_DECISION_PATTERNS = [
  /approve|approval/i,
  /authorize|authorization/i,
  /final decision/i,
  /budget|spend|contract/i,
  /legal|policy/i,
  /exception/i
];

const WEEKDAY_INDEX = Object.freeze({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
});

export function classifyTextForWork(input) {
  const text = String(input.text || '').trim();
  const matchedSignals = WORK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
  const containsWork = matchedSignals.length > 0;
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
    matchedSignals,
    evidence: extractEvidence(text),
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
  const sourceText = `${subject}\n${body}`;
  const classification = classifyTextForWork({ text: sourceText });
  const due = inferDueDate(sourceText, email.receivedAt);
  const title = subject || firstSentence(body) || 'Email follow-up';
  const explanation = explainSuggestion({
    body,
    classification,
    due,
    email,
    ownerId,
    sourceText
  });

  return {
    id: `suggestion_${workspaceId}_${cleanRequired(email.id, 'email.id')}`,
    workspaceId,
    shouldBecomeTask: classification.containsWork,
    status: classification.containsWork ? 'SUGGESTED' : 'REFERENCE_ONLY',
    classification,
    explanation,
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
      dueAt: due.dueAt,
      ownerDecisionRequired: classification.ownerDecisionRequired,
      ownerDecisionReason: classification.ownerDecisionRequired
        ? 'The source appears to request approval or authorization.'
        : '',
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
    rejectionReason: cleanOptional(options.reason) || 'Suggestion rejected during triage review.'
  };
}

function explainSuggestion({ body, classification, due, email, ownerId, sourceText }) {
  const outcome = inferOutcome(body);
  return {
    source: {
      type: 'email',
      messageId: cleanRequired(email.id, 'email.id'),
      receivedAt: email.receivedAt || null
    },
    evidence: classification.evidence,
    workSignals: classification.matchedSignals,
    inferredOutcome: outcome,
    owner: {
      ownerId,
      reason: 'Default owner selected from workspace triage policy.'
    },
    dueDate: {
      dueAt: due.dueAt,
      reason: due.reason
    },
    priority: {
      priority: classification.priority,
      reason: classification.priority === TaskPriority.HIGH
        ? 'Message contains urgent, blocked, today, or ASAP language.'
        : 'No urgent or blocked language was detected.'
    },
    decision: {
      ownerDecisionRequired: classification.ownerDecisionRequired,
      reason: classification.ownerDecisionRequired
        ? 'Message contains approval, authorization, budget, legal, policy, exception, or final-decision language.'
        : 'No owner-only decision language was detected.'
    },
    uncertainties: buildUncertainties({ classification, due, sourceText })
  };
}

function inferOutcome(text) {
  const sentence = firstSentence(text);
  return sentence ? `Requested outcome: ${sentence}` : 'Requested outcome captured from source message.';
}

function inferDueDate(text, receivedAt) {
  const base = receivedAt ? new Date(receivedAt) : new Date();
  if (Number.isNaN(base.getTime())) {
    return { dueAt: null, reason: 'No valid received timestamp available for date inference.' };
  }

  if (/\btoday\b/i.test(text)) {
    return { dueAt: atEndOfDay(base), reason: 'Message uses today deadline language.' };
  }

  if (/\btomorrow\b/i.test(text)) {
    const next = addDays(base, 1);
    return { dueAt: atEndOfDay(next), reason: 'Message uses tomorrow deadline language.' };
  }

  const weekday = text.match(/\bby\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (weekday) {
    const dueDate = nextWeekday(base, WEEKDAY_INDEX[weekday[1].toLowerCase()]);
    return { dueAt: atEndOfDay(dueDate), reason: `Message says by ${weekday[1]}.` };
  }

  return { dueAt: null, reason: 'No explicit due date language was detected.' };
}

function extractEvidence(text) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const match = WORK_PATTERNS.map(({ pattern }) => compact.match(pattern)).find(Boolean);
  if (!match) return compact.slice(0, 180);
  const index = Math.max(0, match.index - 40);
  return compact.slice(index, index + 180).trim();
}

function buildUncertainties({ classification, due, sourceText }) {
  const uncertainties = [];
  if (!classification.containsWork) uncertainties.push('No clear requested work signal detected.');
  if (!due.dueAt) uncertainties.push('Due date not explicit.');
  if (!/\b(reply|respond|send|schedule|call|update|check|ask|follow up)\b/i.test(sourceText)) {
    uncertainties.push('Smallest next action may need human clarification.');
  }
  return uncertainties;
}

function nextWeekday(base, targetDay) {
  const date = new Date(base);
  const currentDay = date.getUTCDay();
  let delta = targetDay - currentDay;
  if (delta < 0) delta += 7;
  return addDays(date, delta);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function atEndOfDay(date) {
  const due = new Date(date);
  due.setUTCHours(17, 0, 0, 0);
  return due.toISOString();
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
