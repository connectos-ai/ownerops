import { createHmac, timingSafeEqual } from 'node:crypto';
import { changeTaskStatus } from '../../core/src/index.js';

const DEFAULT_TOLERANCE_SECONDS = 60 * 5;

export function createSlackSignature({ signingSecret, timestamp, body }) {
  const baseString = `v0:${timestamp}:${body}`;
  return `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;
}

export function verifySlackRequest(input) {
  const signingSecret = String(input.signingSecret || '');
  const timestamp = String(input.timestamp || '');
  const signature = String(input.signature || '');
  const body = String(input.body || '');
  const now = Number.isFinite(input.now) ? input.now : Math.floor(Date.now() / 1000);
  const toleranceSeconds = Number.isFinite(input.toleranceSeconds)
    ? input.toleranceSeconds
    : DEFAULT_TOLERANCE_SECONDS;

  if (!signingSecret) return { ok: false, reason: 'missing_signing_secret' };
  if (!timestamp || !signature) return { ok: false, reason: 'missing_headers' };
  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) return { ok: false, reason: 'invalid_timestamp' };
  if (Math.abs(now - timestampSeconds) > toleranceSeconds) return { ok: false, reason: 'stale_timestamp' };

  const expected = createSlackSignature({ signingSecret, timestamp, body });
  if (!constantTimeEqual(expected, signature)) return { ok: false, reason: 'signature_mismatch' };
  return { ok: true };
}

export function parseSlackInteractionBody(rawBody) {
  const payload = new URLSearchParams(rawBody).get('payload');
  if (!payload) throw validationError('SLACK_PAYLOAD_REQUIRED', 'Slack payload is required.');
  try {
    return JSON.parse(payload);
  } catch {
    throw validationError('SLACK_PAYLOAD_INVALID', 'Slack payload must be valid JSON.');
  }
}

export function handleSlackUrlVerification(payload) {
  if (payload?.type !== 'url_verification') return null;
  return { challenge: String(payload.challenge || '') };
}

export function handleSlackInteraction(payload, store) {
  if (payload?.type !== 'block_actions') {
    throw validationError('SLACK_INTERACTION_UNSUPPORTED', 'Unsupported Slack interaction type.');
  }

  const action = payload.actions?.[0];
  if (!action) throw validationError('SLACK_ACTION_REQUIRED', 'Slack action is required.');
  if (action.action_id !== 'ownerops_task_status') {
    throw validationError('SLACK_ACTION_UNSUPPORTED', 'Unsupported Slack action.');
  }

  const value = parseActionValue(action.value);
  const workspace = store.requireWorkspace(value.workspaceId);
  authorizeSlackWorkspace(payload, workspace);

  const idempotencyKey = slackActionIdempotencyKey(payload, action, value);
  if (store.hasProcessedSlackAction(idempotencyKey)) {
    return {
      response_type: 'ephemeral',
      text: 'OwnerOps already handled this Slack action.'
    };
  }

  const task = store.getTask(value.workspaceId, value.taskId);
  const updated = changeTaskStatus(task, value.status, {
    actorId: `slack:${payload.user?.id || 'unknown'}`,
    blockedReason: value.blockedReason,
    waitingOn: value.waitingOn
  });
  store.updateTask(updated);
  store.markProcessedSlackAction(idempotencyKey);

  return {
    response_type: 'ephemeral',
    text: `OwnerOps updated ${updated.id} to ${updated.status}.`
  };
}

export function slackActionIdempotencyKey(payload, action, value) {
  return [
    payload.team?.id || 'unknown_team',
    payload.user?.id || 'unknown_user',
    action.action_id,
    value.workspaceId,
    value.taskId,
    value.status,
    action.action_ts || payload.action_ts || payload.trigger_id || 'unknown_action'
  ].join(':');
}

function parseActionValue(value) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return {
      workspaceId: cleanRequired(parsed.workspaceId, 'workspaceId'),
      taskId: cleanRequired(parsed.taskId, 'taskId'),
      status: cleanRequired(parsed.status, 'status'),
      blockedReason: parsed.blockedReason,
      waitingOn: parsed.waitingOn
    };
  } catch (error) {
    if (error.code) throw error;
    throw validationError('SLACK_ACTION_VALUE_INVALID', 'Slack action value must be valid JSON.');
  }
}

function authorizeSlackWorkspace(payload, workspace) {
  const expectedTeamId = workspace.policies?.slackTeamId;
  const actualTeamId = payload.team?.id;
  if (expectedTeamId && expectedTeamId !== actualTeamId) {
    const error = validationError('SLACK_WORKSPACE_FORBIDDEN', 'Slack team is not authorized for this workspace.');
    error.statusCode = 403;
    throw error;
  }
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function cleanRequired(value, name) {
  const text = String(value || '').trim();
  if (!text) throw validationError('VALIDATION_ERROR', `${name} required.`);
  return text;
}

function validationError(code, message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}
