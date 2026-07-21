import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import { TaskPriority, TaskStatus, changeTaskStatus } from '../../core/src/index.js';

const DEFAULT_TOLERANCE_SECONDS = 60 * 5;
const DEFAULT_OAUTH_STATE_TTL_SECONDS = 60 * 10;
const DEFAULT_BOT_SCOPES = [
  'commands',
  'chat:write',
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'users:read'
];

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

export async function handleSlackEvent(payload, store, options = {}) {
  const eventType = payload?.event?.type;
  if (!eventType) return { ok: true };
  if (eventType === 'app_uninstalled') {
    store.revokeSlackInstallationByTeam?.(payload.team_id, 'app_uninstalled');
    return { ok: true };
  }
  if (eventType === 'tokens_revoked') {
    store.revokeSlackInstallationByTeam?.(payload.team_id, 'tokens_revoked');
    return { ok: true };
  }
  if (eventType === 'app_home_opened') {
    const result = await publishSlackAppHomeFromInstallation({
      store,
      teamId: payload.team_id,
      slackUserId: payload.event?.user,
      tokenEncryptionKey: options.tokenEncryptionKey,
      publishView: options.publishView
    });
    return { ok: true, published: true, viewId: result.viewId };
  }
  return { ok: true };
}

export function buildSlackOAuthAuthorizeUrl(input) {
  const clientId = cleanRequired(input.clientId, 'clientId');
  const redirectUri = cleanRequired(input.redirectUri, 'redirectUri');
  const state = cleanRequired(input.state, 'state');
  const scopes = input.scopes?.length ? input.scopes : DEFAULT_BOT_SCOPES;
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes.join(','));
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  if (input.userScopes?.length) url.searchParams.set('user_scope', input.userScopes.join(','));
  return url.toString();
}

export function createSlackOAuthState(input) {
  const stateSecret = cleanRequired(input.stateSecret, 'stateSecret');
  const now = Number.isFinite(input.now) ? input.now : Math.floor(Date.now() / 1000);
  const ttlSeconds = Number.isFinite(input.ttlSeconds) ? input.ttlSeconds : DEFAULT_OAUTH_STATE_TTL_SECONDS;
  const payload = {
    version: 1,
    workspaceId: cleanRequired(input.workspaceId, 'workspaceId'),
    redirectUri: cleanRequired(input.redirectUri, 'redirectUri'),
    expiresAt: now + ttlSeconds,
    nonce: input.nonce || randomBytes(16).toString('base64url')
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = hmacBase64Url(stateSecret, encoded);
  return `${encoded}.${signature}`;
}

export function verifySlackOAuthState(input) {
  const stateSecret = cleanRequired(input.stateSecret, 'stateSecret');
  const state = cleanRequired(input.state, 'state');
  const now = Number.isFinite(input.now) ? input.now : Math.floor(Date.now() / 1000);
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) throw oauthStateError();
  const expected = hmacBase64Url(stateSecret, encoded);
  if (!constantTimeEqual(expected, signature)) throw oauthStateError();
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw oauthStateError();
  }
  if (payload.version !== 1 || !payload.workspaceId || !payload.redirectUri) throw oauthStateError();
  if (Number(payload.expiresAt || 0) < now) {
    const error = oauthStateError();
    error.code = 'SLACK_OAUTH_STATE_EXPIRED';
    throw error;
  }
  return payload;
}

export function createSlackInstallationFromOAuth(response, input) {
  if (!response?.ok) {
    throw validationError('SLACK_OAUTH_EXCHANGE_FAILED', response?.error || 'Slack OAuth exchange failed.');
  }
  const teamId = cleanRequired(response.team?.id || response.team_id, 'team.id');
  const installedAt = input.installedAt || new Date().toISOString();
  return {
    id: `slack_installation_${sanitizeIdPart(teamId)}`,
    workspaceId: cleanRequired(input.workspaceId, 'workspaceId'),
    teamId,
    teamName: response.team?.name || '',
    enterpriseId: response.enterprise?.id || '',
    appId: response.app_id || '',
    botUserId: response.bot_user_id || '',
    botScopes: parseScopes(response.scope),
    userScopes: parseScopes(response.authed_user?.scope),
    installedBy: response.authed_user?.id ? `slack:${response.authed_user.id}` : '',
    installedAt,
    updatedAt: installedAt,
    revokedAt: null,
    revokedReason: '',
    status: 'ACTIVE',
    botToken: encryptSlackToken(response.access_token, input.tokenEncryptionKey),
    authedUserToken: response.authed_user?.access_token
      ? encryptSlackToken(response.authed_user.access_token, input.tokenEncryptionKey)
      : null
  };
}

export function encryptSlackToken(value, encryptionKey) {
  const token = cleanRequired(value, 'token');
  const key = deriveEncryptionKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: 'aes-256-gcm',
    keyVersion: 'local-v1',
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: tag.toString('base64url')
  };
}

export function decryptSlackToken(record, encryptionKey) {
  if (!record) return '';
  const key = deriveEncryptionKey(encryptionKey);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

export async function sendSlackMessageFromInstallation(input) {
  const installation = requireActiveSlackInstallation(input);
  const token = decryptSlackToken(installation.botToken, input.tokenEncryptionKey);
  const response = await input.postMessage({
    token,
    channel: cleanRequired(input.channel, 'channel'),
    text: cleanRequired(input.text, 'text'),
    blocks: Array.isArray(input.blocks) ? input.blocks : []
  });
  if (!response?.ok) {
    throw slackSendError('SLACK_MESSAGE_SEND_FAILED', response?.error || 'Slack message send failed.', 502);
  }
  return {
    ok: true,
    teamId: installation.teamId,
    channel: response.channel || input.channel,
    ts: response.ts || '',
    messageText: response.message?.text || input.text
  };
}

export async function openSlackTaskCreateModalFromInstallation(input) {
  const installation = requireActiveSlackInstallation(input);
  const token = decryptSlackToken(installation.botToken, input.tokenEncryptionKey);
  const response = await input.openView({
    token,
    triggerId: cleanRequired(input.triggerId, 'triggerId'),
    view: buildOwnerOpsTaskCreateView(input)
  });
  if (!response?.ok) {
    throw slackSendError('SLACK_MODAL_OPEN_FAILED', response?.error || 'Slack modal open failed.', 502);
  }
  return {
    ok: true,
    teamId: installation.teamId,
    viewId: response.view?.id || '',
    callbackId: response.view?.callback_id || 'ownerops_task_create'
  };
}

export async function publishSlackAppHomeFromInstallation(input) {
  const workspace = findWorkspaceBySlackTeam(input.store, input.teamId);
  const installation = requireActiveSlackInstallation({
    store: input.store,
    workspaceId: workspace.id,
    teamId: input.teamId
  });
  const token = decryptSlackToken(installation.botToken, input.tokenEncryptionKey);
  const slackUserId = cleanRequired(input.slackUserId, 'slackUserId');
  const tasks = input.store.allTasks(workspace.id);
  const response = await input.publishView({
    token,
    userId: slackUserId,
    view: buildOwnerOpsAppHomeView({
      workspace,
      slackUserId,
      tasks
    })
  });
  if (!response?.ok) {
    throw slackSendError('SLACK_APP_HOME_PUBLISH_FAILED', response?.error || 'Slack App Home publish failed.', 502);
  }
  return {
    ok: true,
    teamId: installation.teamId,
    userId: slackUserId,
    viewId: response.view?.id || ''
  };
}

export async function postSlackMessage({ token, channel, text, blocks = [] }) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cleanRequired(token, 'token')}`,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      channel: cleanRequired(channel, 'channel'),
      text: cleanRequired(text, 'text'),
      blocks
    })
  });
  return response.json();
}

export async function publishSlackView({ token, userId, view }) {
  const response = await fetch('https://slack.com/api/views.publish', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cleanRequired(token, 'token')}`,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      user_id: cleanRequired(userId, 'userId'),
      view
    })
  });
  return response.json();
}

function requireActiveSlackInstallation(input) {
  const installation = input.store.getSlackInstallationByTeam?.(input.teamId);
  if (!installation || installation.workspaceId !== input.workspaceId) {
    throw slackSendError('SLACK_INSTALLATION_NOT_FOUND', 'Slack installation not found.', 404);
  }
  if (installation.status !== 'ACTIVE' || !installation.botToken) {
    throw slackSendError('SLACK_INSTALLATION_INACTIVE', 'Slack installation is not active.', 409);
  }
  return installation;
}

export function buildOwnerOpsTaskCreateView(input = {}) {
  return {
    type: 'modal',
    callback_id: 'ownerops_task_create',
    private_metadata: JSON.stringify({
      sourceType: input.sourceType || 'slack_command',
      channelId: input.channelId || ''
    }),
    title: {
      type: 'plain_text',
      text: 'OwnerOps Task'
    },
    submit: {
      type: 'plain_text',
      text: 'Create'
    },
    close: {
      type: 'plain_text',
      text: 'Cancel'
    },
    blocks: [
      {
        type: 'input',
        block_id: 'title_block',
        label: {
          type: 'plain_text',
          text: 'Task'
        },
        element: {
          type: 'plain_text_input',
          action_id: 'title_action',
          placeholder: {
            type: 'plain_text',
            text: 'Follow up with customer'
          }
        }
      },
      {
        type: 'input',
        block_id: 'description_block',
        optional: true,
        label: {
          type: 'plain_text',
          text: 'Details'
        },
        element: {
          type: 'plain_text_input',
          action_id: 'description_action',
          multiline: true
        }
      },
      {
        type: 'input',
        block_id: 'due_date_block',
        optional: true,
        label: {
          type: 'plain_text',
          text: 'Due date'
        },
        element: {
          type: 'datepicker',
          action_id: 'due_date_action'
        }
      },
      {
        type: 'input',
        block_id: 'priority_block',
        optional: true,
        label: {
          type: 'plain_text',
          text: 'Priority'
        },
        element: {
          type: 'static_select',
          action_id: 'priority_action',
          options: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((priority) => ({
            text: {
              type: 'plain_text',
              text: priority
            },
            value: priority
          }))
        }
      }
    ]
  };
}

export function buildOwnerOpsAppHomeView({ workspace, slackUserId, tasks }) {
  const owner = findWorkspaceUserBySlackId(workspace, slackUserId);
  const activeTasks = tasks.filter((task) => !task.archivedAt && task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED);
  const assigned = owner
    ? activeTasks.filter((task) => task.ownerId === owner.id)
    : [];
  const inbox = activeTasks.filter((task) => task.status === TaskStatus.INBOX || task.ownerId === 'unassigned');
  const blocked = activeTasks.filter((task) => task.status === TaskStatus.BLOCKED);
  const waiting = activeTasks.filter((task) => task.status === TaskStatus.WAITING);
  return {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'OwnerOps Home'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${workspace.name || 'Workspace'}* operating snapshot for <@${slackUserId}>.`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'New task'
            },
            action_id: 'ownerops_open_task_modal',
            value: JSON.stringify({ workspaceId: workspace.id })
          }
        ]
      },
      taskBucketSection('Inbox', inbox),
      taskBucketSection('Assigned to you', assigned),
      taskBucketSection('Blocked', blocked),
      taskBucketSection('Waiting', waiting),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Use `/ownerops new` to create work, or turn a Slack message into a task from message shortcuts.'
          }
        ]
      }
    ]
  };
}

export async function openSlackView({ token, triggerId, view }) {
  const response = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cleanRequired(token, 'token')}`,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      trigger_id: cleanRequired(triggerId, 'triggerId'),
      view
    })
  });
  return response.json();
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

export async function handleSlackCommand(body, store, options = {}) {
  const command = cleanRequired(body.command, 'command');
  const text = cleanRequired(body.text, 'text');
  const workspace = findWorkspaceBySlackTeam(store, body.team_id);

  if (/^(new|create|modal)$/i.test(text)) {
    await openSlackTaskCreateModalFromInstallation({
      store,
      workspaceId: workspace.id,
      teamId: body.team_id,
      triggerId: body.trigger_id,
      channelId: body.channel_id,
      tokenEncryptionKey: options.tokenEncryptionKey,
      openView: options.openView
    });
    return {
      response_type: 'ephemeral',
      text: 'OwnerOps opened the task creation modal.'
    };
  }

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

function findWorkspaceUserBySlackId(workspace, slackUserId) {
  return (workspace.users || []).find((user) => user.externalIds?.slackUserId === slackUserId) || null;
}

function taskBucketSection(label, tasks) {
  const lines = tasks.slice(0, 5).map((task) => `• ${slackSafeLine(task.title)} (${task.status})`);
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${label}* (${tasks.length})\n${lines.length ? lines.join('\n') : 'Nothing here right now.'}`
    }
  };
}

function slackSafeLine(value) {
  return String(value || '').replace(/[<&>]/g, '').trim().slice(0, 100) || 'Untitled task';
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

function parseScopes(value) {
  return String(value || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function deriveEncryptionKey(encryptionKey) {
  return createHash('sha256')
    .update(cleanRequired(encryptionKey, 'tokenEncryptionKey'))
    .digest();
}

function hmacBase64Url(secret, value) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function oauthStateError() {
  return validationError('SLACK_OAUTH_STATE_INVALID', 'Slack OAuth state is invalid.');
}

function slackSendError(code, message, statusCode) {
  const error = validationError(code, message);
  error.statusCode = statusCode;
  return error;
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
