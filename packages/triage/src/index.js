import { TaskPriority } from '../../core/src/index.js';

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
