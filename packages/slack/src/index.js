import { createHmac, timingSafeEqual } from 'node:crypto';
import { TaskPriority, TaskStatus, changeTaskStatus } from '../../core/src/index.js';

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
  if (payload?.type === 'message_action') {
    return handleSlackMessageAction(payload, store);
  }

  if (payload?.type === 'view_submission') {
    return handleSlackViewSubmission(payload, store);
  }

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

export function handleSlackCommand(body, store) {
  const command = cleanRequired(body.command, 'command');
  const text = cleanRequired(body.text, 'text');
  const workspace = findWorkspaceBySlackTeam(store, body.team_id);
  const taskText = parseOwnerOpsCommandText(text);
  const sourceReference = [
    cleanRequired(body.team_id, 'team_id'),
    cleanRequired(body.channel_id, 'channel_id'),
    cleanRequired(body.user_id, 'user_id'),
    command,
    text
  ].join(':');

  const existing = store.findTaskBySource(workspace.id, 'slack_command', sourceReference);
  if (existing) {
    return {
      response_type: 'ephemeral',
      text: `OwnerOps already has ${existing.id} for this command.`
    };
  }

  const task = store.createTask({
    id: `task_from_slack_command_${sanitizeIdPart(body.team_id)}_${sanitizeIdPart(body.channel_id)}_${sanitizeIdPart(body.user_id)}`,
    workspaceId: workspace.id,
    title: taskText.title,
    description: taskText.description,
    desiredOutcome: `Requested outcome: ${taskText.title}`,
    sourceType: 'slack_command',
    sourceReference,
    sourceUrl: '',
    createdBy: `slack:${body.user_id}`,
    ownerId: 'unassigned',
    requestedBy: `slack:${body.user_id}`,
    status: TaskStatus.INBOX,
    priority: inferPriority(taskText.title),
    tags: ['slack']
  });

  return {
    response_type: 'ephemeral',
    text: `OwnerOps created ${task.id}.`
  };
}

export function handleSlackMessageAction(payload, store) {
  if (payload.callback_id !== 'ownerops_turn_message_into_task') {
    throw validationError('SLACK_SHORTCUT_UNSUPPORTED', 'Unsupported Slack shortcut.');
  }

  const workspace = findWorkspaceBySlackTeam(store, payload.team?.id);
  authorizeSlackWorkspace(payload, workspace);

  const sourceReference = slackMessageSourceReference(payload);
  const idempotencyKey = [
    payload.team?.id || 'unknown_team',
    payload.user?.id || 'unknown_user',
    payload.callback_id,
    sourceReference
  ].join(':');

  if (store.hasProcessedSlackAction(idempotencyKey)) {
    return {
      response_type: 'ephemeral',
      text: 'OwnerOps already handled this Slack action.'
    };
  }

  const existing = store.findTaskBySource(workspace.id, 'slack_message', sourceReference);
  if (existing) {
    store.markProcessedSlackAction(idempotencyKey);
    return {
      response_type: 'ephemeral',
      text: `OwnerOps already has ${existing.id} for this Slack message.`
    };
  }

  const task = store.createTask(slackMessageToTask(payload, workspace.id, sourceReference));
  store.markProcessedSlackAction(idempotencyKey);
  return {
    response_type: 'ephemeral',
    text: `OwnerOps created ${task.id} from Slack.`
  };
}

export function handleSlackViewSubmission(payload, store) {
  const callbackId = cleanRequired(payload.view?.callback_id, 'view.callback_id');
  if (callbackId !== 'ownerops_task_create') {
    throw validationError('SLACK_VIEW_UNSUPPORTED', 'Unsupported Slack view submission.');
  }

  const workspace = findWorkspaceBySlackTeam(store, payload.team?.id);
  authorizeSlackWorkspace(payload, workspace);

  const sourceReference = slackViewSourceReference(payload);
  const idempotencyKey = [
    payload.team?.id || 'unknown_team',
    payload.user?.id || 'unknown_user',
    callbackId,
    sourceReference
  ].join(':');

  if (store.hasProcessedSlackAction(idempotencyKey)) {
    return {
      response_action: 'clear',
      text: 'OwnerOps already handled Slack modal.'
    };
  }

  const existing = store.findTaskBySource(workspace.id, 'slack_modal', sourceReference);
  if (existing) {
    store.markProcessedSlackAction(idempotencyKey);
    return {
      response_action: 'clear',
      text: `OwnerOps already ${existing.id} for Slack modal.`
    };
  }

  const task = store.createTask(slackViewSubmissionToTask(payload, workspace.id, sourceReference));
  store.markProcessedSlackAction(idempotencyKey);

  return {
    response_action: 'clear',
    text: `OwnerOps created ${task.id}.`
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

function findWorkspaceBySlackTeam(store, slackTeamId) {
  const workspace = store.findWorkspaceBySlackTeam?.(slackTeamId);
  if (!workspace) {
    const error = validationError('SLACK_WORKSPACE_NOT_FOUND', 'No OwnerOps workspace is mapped to this Slack team.');
    error.statusCode = 404;
    throw error;
  }
  return workspace;
}

function slackMessageToTask(payload, workspaceId, sourceReference) {
  const message = payload.message || {};
  const channelId = cleanRequired(payload.channel?.id, 'channelId');
  const messageTs = cleanRequired(message.ts, 'message.ts');
  const messageText = cleanRequired(message.text, 'message.text');
  const taskId = `task_from_slack_${sanitizeIdPart(channelId)}_${sanitizeIdPart(messageTs)}`;
  return {
    id: taskId,
    workspaceId,
    title: firstLine(messageText),
    description: messageText,
    desiredOutcome: `Requested outcome: ${firstLine(messageText)}`,
    sourceType: 'slack_message',
    sourceReference,
    sourceUrl: message.permalink || '',
    createdBy: `slack:${payload.user?.id || 'unknown'}`,
    ownerId: 'unassigned',
    requestedBy: `slack:${message.user || payload.user?.id || 'unknown'}`,
    status: TaskStatus.READY,
    priority: inferPriority(messageText),
    tags: ['slack']
  };
}

function slackViewSubmissionToTask(payload, workspaceId, sourceReference) {
  const values = payload.view?.state?.values || {};
  const title = firstLine(cleanRequired(slackInputValue(values, 'title'), 'title'));
  const description = slackInputValue(values, 'description') || '';
  const dueAt = slackInputValue(values, 'dueDate');
  const priority = slackInputValue(values, 'priority') || inferPriority(`${title} ${description}`);
  const viewId = cleanRequired(payload.view?.id, 'view.id');

  return {
    id: `task_from_slack_modal_${sanitizeIdPart(viewId)}`,
    workspaceId,
    title,
    description,
    desiredOutcome: `Requested outcome: ${title}`,
    sourceType: 'slack_modal',
    sourceReference,
    sourceUrl: '',
    createdBy: `slack:${payload.user?.id || 'unknown'}`,
    ownerId: 'unassigned',
    requestedBy: `slack:${payload.user?.id || 'unknown'}`,
    status: TaskStatus.INBOX,
    priority,
    dueAt,
    tags: ['slack']
  };
}

function parseOwnerOpsCommandText(text) {
  const trimmed = cleanRequired(text, 'text');
  const taskMatch = trimmed.match(/^task\s+(.+)$/i);
  if (!taskMatch) {
    throw validationError('SLACK_COMMAND_UNSUPPORTED', 'Use /ownerops task <task title>.');
  }
  const title = cleanRequired(taskMatch[1], 'task title');
  return { title: firstLine(title), description: title };
}

function slackMessageSourceReference(payload) {
  return [
    cleanRequired(payload.team?.id, 'team.id'),
    cleanRequired(payload.channel?.id, 'channel.id'),
    cleanRequired(payload.message?.ts, 'message.ts')
  ].join(':');
}

function slackViewSourceReference(payload) {
  return [
    cleanRequired(payload.team?.id, 'team.id'),
    cleanRequired(payload.view?.id, 'view.id'),
    payload.view?.hash || payload.view?.root_view_id || 'submitted'
  ].join(':');
}

function slackInputValue(values, fieldName) {
  const normalizedFieldName = normalizeFieldName(fieldName);
  for (const [blockId, actions] of Object.entries(values)) {
    for (const [actionId, input] of Object.entries(actions || {})) {
      const normalizedBlockId = normalizeFieldName(blockId);
      const normalizedActionId = normalizeFieldName(actionId);
      if (!normalizedBlockId.includes(normalizedFieldName) && !normalizedActionId.includes(normalizedFieldName)) {
        continue;
      }
      return extractSlackInputValue(input);
    }
  }
  return '';
}

function extractSlackInputValue(input) {
  if (!input) return '';
  if (typeof input.value === 'string') return input.value.trim();
  if (typeof input.selected_date === 'string') return input.selected_date.trim();
  if (typeof input.selected_time === 'string') return input.selected_time.trim();
  if (typeof input.selected_option?.value === 'string') return input.selected_option.value.trim();
  if (typeof input.selected_option?.text?.text === 'string') return input.selected_option.text.text.trim();
  return '';
}

function normalizeFieldName(value) {
  return String(value || '').replace(/[^A-Za-z0-9]+/g, '').toLowerCase();
}

function inferPriority(text) {
  return /urgent|today|asap|blocked|blocking/i.test(text) ? TaskPriority.HIGH : TaskPriority.NORMAL;
}

function firstLine(text) {
  return String(text || '').trim().split(/\r?\n/)[0].slice(0, 120);
}

function sanitizeIdPart(value) {
  return String(value || '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 80);
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
