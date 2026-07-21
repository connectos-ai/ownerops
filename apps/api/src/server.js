import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assignTask,
  changeSubtaskStatus,
  changeTaskStatus,
  createRecurringTaskInstance,
  generateDailyBrief,
  generateWeeklyReview,
  groupTasksForKanban,
  requestOwnerDecision,
  resolveOwnerDecision,
  updateTaskDetails
} from '../../../packages/core/src/index.js';
import { FileOwnerOpsStore, InMemoryOwnerOpsStore } from '../../../packages/storage/src/index.js';
import {
  buildSlackOAuthAuthorizeUrl,
  createSlackInstallationFromOAuth,
  createSlackOAuthState,
  handleSlackCommand,
  handleSlackEvent,
  handleSlackInteraction,
  handleSlackUrlVerification,
  openSlackView,
  postSlackMessage,
  publishSlackView,
  parseSlackInteractionBody,
  sendSlackMessageFromInstallation,
  verifySlackOAuthState,
  verifySlackRequest
} from '../../../packages/slack/src/index.js';
import { approveSuggestedTask, triageEmailToTaskSuggestion } from '../../../packages/triage/src/index.js';

export { FileOwnerOpsStore, InMemoryOwnerOpsStore };

export function createOwnerOpsServer(options = {}) {
  const store = options.store || createDefaultStore(options);
  const slackSigningSecret = options.slackSigningSecret || process.env.OWNEROPS_SLACK_SIGNING_SECRET || '';
  const slackOAuth = createSlackOAuthConfig(options);
  const slackWebApi = createSlackWebApiConfig(options);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const requestBody = await readRequestBody(req);
      const result = await route({
        method: req.method || 'GET',
        url,
        body: requestBody.body,
        rawBody: requestBody.rawBody,
        headers: req.headers,
        store,
        slackSigningSecret,
        slackOAuth,
        slackWebApi
      });
      sendResponse(res, result);
    } catch (error) {
      sendJson(res, error.statusCode || 500, {
        error: {
          code: error.code || 'OWNEROPS_ERROR',
          message: error.message || 'OwnerOps request failed.'
        }
      });
    }
  });
  server.ownerOpsStore = store;
  return server;
}

function createDefaultStore(options) {
  if (options.filePath || process.env.OWNEROPS_DATA_FILE) {
    return new FileOwnerOpsStore({ filePath: options.filePath || process.env.OWNEROPS_DATA_FILE });
  }
  return new InMemoryOwnerOpsStore();
}

function createSlackOAuthConfig(options) {
  const provided = options.slackOAuth || {};
  return {
    clientId: provided.clientId || process.env.OWNEROPS_SLACK_CLIENT_ID || '',
    clientSecret: provided.clientSecret || process.env.OWNEROPS_SLACK_CLIENT_SECRET || '',
    redirectUri: provided.redirectUri || process.env.OWNEROPS_SLACK_REDIRECT_URI || '',
    stateSecret: provided.stateSecret || process.env.OWNEROPS_SLACK_OAUTH_STATE_SECRET || '',
    tokenEncryptionKey: provided.tokenEncryptionKey || process.env.OWNEROPS_TOKEN_ENCRYPTION_KEY || '',
    scopes: provided.scopes || parseCsv(process.env.OWNEROPS_SLACK_SCOPES || ''),
    userScopes: provided.userScopes || parseCsv(process.env.OWNEROPS_SLACK_USER_SCOPES || ''),
    exchangeOAuthCode: provided.exchangeOAuthCode || exchangeSlackOAuthCode
  };
}

function createSlackWebApiConfig(options) {
  const provided = options.slackWebApi || {};
  return {
    openView: provided.openView || openSlackView,
    postMessage: provided.postMessage || postSlackMessage,
    publishView: provided.publishView || publishSlackView
  };
}

async function route({ method, url, body, rawBody, headers, store, slackSigningSecret, slackOAuth, slackWebApi }) {
  if (method === 'GET' && url.pathname === '/favicon.ico') {
    return { status: 204, body: '', contentType: 'image/x-icon' };
  }

  if (method === 'GET' && ['/','/app.js','/styles.css'].includes(url.pathname)) {
    return staticWebAsset(url.pathname);
  }

  if (method === 'GET' && url.pathname === '/healthz') {
    return { body: { ok: true, service: 'ownerops-api' } };
  }

  if (method === 'GET' && url.pathname === '/slack/oauth/start') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    const state = createSlackOAuthState({
      workspaceId,
      redirectUri: slackOAuth.redirectUri,
      stateSecret: slackOAuth.stateSecret
    });
    return {
      body: {
        authorizeUrl: buildSlackOAuthAuthorizeUrl({
          clientId: slackOAuth.clientId,
          redirectUri: slackOAuth.redirectUri,
          scopes: slackOAuth.scopes,
          userScopes: slackOAuth.userScopes,
          state
        })
      }
    };
  }

  if (method === 'GET' && url.pathname === '/slack/oauth/callback') {
    return handleSlackOAuthCallback({ url, store, slackOAuth });
  }

  if (method === 'POST' && url.pathname === '/slack/events') {
    requireValidSlackSignature({ headers, rawBody, slackSigningSecret });
    const urlVerification = handleSlackUrlVerification(body);
    if (urlVerification) return { body: urlVerification };
    return {
      body: await handleSlackEvent(body, store, {
        tokenEncryptionKey: slackOAuth.tokenEncryptionKey,
        publishView: slackWebApi.publishView
      })
    };
  }

  if (method === 'POST' && url.pathname === '/slack/interactions') {
    requireValidSlackSignature({ headers, rawBody, slackSigningSecret });
    const payload = parseSlackInteractionBody(rawBody);
    return { body: handleSlackInteraction(payload, store) };
  }

  if (method === 'POST' && url.pathname === '/slack/commands') {
    requireValidSlackSignature({ headers, rawBody, slackSigningSecret });
    return {
      body: await handleSlackCommand(body, store, {
        tokenEncryptionKey: slackOAuth.tokenEncryptionKey,
        openView: slackWebApi.openView
      })
    };
  }

  if (method === 'POST' && url.pathname === '/api/slack/messages') {
    store.requireWorkspace(body.workspaceId);
    return {
      body: await sendSlackMessageFromInstallation({
        store,
        workspaceId: body.workspaceId,
        teamId: body.teamId,
        channel: body.channel,
        text: body.text,
        blocks: body.blocks,
        tokenEncryptionKey: slackOAuth.tokenEncryptionKey,
        postMessage: slackWebApi.postMessage
      })
    };
  }

  if (method === 'POST' && url.pathname === '/api/workspaces') {
    return { status: 201, body: store.createWorkspace(body) };
  }

  const workspaceGetMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (method === 'GET' && workspaceGetMatch) {
    return { body: store.requireWorkspace(workspaceGetMatch[1]) };
  }

  const workspaceUserMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/users$/);
  if (method === 'POST' && workspaceUserMatch) {
    return { status: 201, body: store.addWorkspaceUser(workspaceUserMatch[1], body) };
  }

  const workspaceProjectMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/projects$/);
  if (method === 'POST' && workspaceProjectMatch) {
    return { status: 201, body: store.createProject(workspaceProjectMatch[1], body) };
  }

  const workspaceListMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/lists$/);
  if (method === 'POST' && workspaceListMatch) {
    return { status: 201, body: store.createTaskList(workspaceListMatch[1], body) };
  }

  if (method === 'POST' && url.pathname === '/api/tasks') {
    store.requireWorkspace(body.workspaceId);
    return { status: 201, body: store.createTask(body) };
  }

  if (method === 'GET' && url.pathname === '/api/tasks') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: { tasks: store.listTasks(workspaceId, queryFilters(url)) } };
  }

  const taskUpdateMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (method === 'PATCH' && taskUpdateMatch) {
    const task = store.getTask(body.workspaceId, taskUpdateMatch[1]);
    const updated = updateTaskDetails(task, body);
    return { body: store.updateTask(updated) };
  }

  const taskStatusMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
  if (method === 'PATCH' && taskStatusMatch) {
    const task = store.getTask(body.workspaceId, taskStatusMatch[1]);
    const updated = changeTaskStatus(task, body.status, body);
    return { body: store.updateTask(updated) };
  }

  const taskAssignMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/assign$/);
  if (method === 'PATCH' && taskAssignMatch) {
    const task = store.getTask(body.workspaceId, taskAssignMatch[1]);
    const updated = assignTask(task, body.ownerId, body);
    return { body: store.updateTask(updated) };
  }

  const taskCommentMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/comments$/);
  if (method === 'POST' && taskCommentMatch) {
    return {
      status: 201,
      body: store.addTaskComment(body.workspaceId, taskCommentMatch[1], body)
    };
  }

  const taskSubtaskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/subtasks$/);
  if (method === 'POST' && taskSubtaskMatch) {
    return {
      status: 201,
      body: store.addSubtask(body.workspaceId, taskSubtaskMatch[1], body)
    };
  }

  const subtaskStatusMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/subtasks\/([^/]+)\/status$/);
  if (method === 'PATCH' && subtaskStatusMatch) {
    const task = store.getTask(body.workspaceId, subtaskStatusMatch[1]);
    const updated = changeSubtaskStatus(task, subtaskStatusMatch[2], body.status, body);
    return { body: store.updateTask(updated) };
  }

  const taskArchiveMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/archive$/);
  if (method === 'POST' && taskArchiveMatch) {
    return { body: store.archiveTask(body.workspaceId, taskArchiveMatch[1], body) };
  }

  const taskReopenMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/reopen$/);
  if (method === 'POST' && taskReopenMatch) {
    return { body: store.reopenTask(body.workspaceId, taskReopenMatch[1], body) };
  }

  const recurringMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/recurring-instance$/);
  if (method === 'POST' && recurringMatch) {
    const task = store.getTask(body.workspaceId, recurringMatch[1]);
    return { status: 201, body: store.createTask(createRecurringTaskInstance(task, body)) };
  }

  const ownerDecisionMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/owner-decision$/);
  if (method === 'POST' && ownerDecisionMatch) {
    const task = store.getTask(body.workspaceId, ownerDecisionMatch[1]);
    const updated = requestOwnerDecision(task, body);
    return { body: store.updateTask(updated) };
  }

  const ownerDecisionResolveMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/owner-decision\/resolve$/);
  if (method === 'POST' && ownerDecisionResolveMatch) {
    const task = store.getTask(body.workspaceId, ownerDecisionResolveMatch[1]);
    const updated = resolveOwnerDecision(task, body);
    return { body: store.updateTask(updated) };
  }

  if (method === 'GET' && url.pathname === '/api/boards/kanban') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: groupTasksForKanban(store.listTasks(workspaceId, queryFilters(url))) };
  }

  if (method === 'POST' && url.pathname === '/api/triage/email') {
    store.requireWorkspace(body.workspaceId);
    const suggestion = triageEmailToTaskSuggestion(body.email, body);
    return { status: 201, body: store.saveSuggestion(suggestion) };
  }

  const suggestionApproveMatch = url.pathname.match(/^\/api\/triage\/suggestions\/([^/]+)\/approve$/);
  if (method === 'POST' && suggestionApproveMatch) {
    const suggestion = store.getSuggestion(body.workspaceId, suggestionApproveMatch[1]);
    const task = await approveSuggestedTask(suggestion, {
      createTask: (item) => store.createTaskFromSuggestion(item)
    }, body);
    return { status: 201, body: task };
  }

  if (method === 'GET' && url.pathname === '/api/briefs/daily') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return {
      body: generateDailyBrief(store.allTasks(workspaceId), { now: url.searchParams.get('now') || undefined })
    };
  }

  if (method === 'GET' && url.pathname === '/api/briefs/weekly') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: generateWeeklyReview(store.allTasks(workspaceId)) };
  }

  throw notFound('ROUTE_NOT_FOUND', 'Route not found.');
}

async function handleSlackOAuthCallback({ url, store, slackOAuth }) {
  if (url.searchParams.get('error')) {
    const error = new Error(`Slack OAuth rejected: ${url.searchParams.get('error')}`);
    error.statusCode = 400;
    error.code = 'SLACK_OAUTH_REJECTED';
    throw error;
  }
  const code = requiredQuery(url, 'code');
  const state = requiredQuery(url, 'state');
  const payload = verifySlackOAuthState({
    state,
    stateSecret: slackOAuth.stateSecret
  });
  store.requireWorkspace(payload.workspaceId);
  if (payload.redirectUri !== slackOAuth.redirectUri) {
    const error = new Error('Slack OAuth redirect URI mismatch.');
    error.statusCode = 400;
    error.code = 'SLACK_OAUTH_REDIRECT_MISMATCH';
    throw error;
  }
  const exchange = await slackOAuth.exchangeOAuthCode({
    code,
    clientId: slackOAuth.clientId,
    clientSecret: slackOAuth.clientSecret,
    redirectUri: slackOAuth.redirectUri
  });
  const installation = createSlackInstallationFromOAuth(exchange, {
    workspaceId: payload.workspaceId,
    tokenEncryptionKey: slackOAuth.tokenEncryptionKey
  });
  store.saveSlackInstallation(installation);
  return {
    body: {
      ok: true,
      workspaceId: installation.workspaceId,
      teamId: installation.teamId,
      botUserId: installation.botUserId,
      status: installation.status
    }
  };
}

async function readRequestBody(req) {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method || 'GET')) return {};
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return { rawBody: '', body: {} };
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return { rawBody: raw, body: Object.fromEntries(new URLSearchParams(raw).entries()) };
  }
  try {
    return { rawBody: raw, body: JSON.parse(raw) };
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function requireValidSlackSignature({ headers, rawBody, slackSigningSecret }) {
  const result = verifySlackRequest({
    signingSecret: slackSigningSecret,
    timestamp: headers['x-slack-request-timestamp'],
    signature: headers['x-slack-signature'],
    body: rawBody
  });
  if (!result.ok) {
    const error = new Error('Slack request signature verification failed.');
    error.statusCode = 401;
    error.code = `SLACK_SIGNATURE_${result.reason.toUpperCase()}`;
    throw error;
  }
}

async function exchangeSlackOAuthCode({ code, clientId, clientSecret, redirectUri }) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({ code, redirect_uri: redirectUri });
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });
  return response.json();
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendResponse(res, result) {
  if (result.contentType) {
    res.writeHead(result.status || 200, { 'content-type': result.contentType });
    res.end(result.body);
    return;
  }
  sendJson(res, result.status || 200, result.body);
}

function staticWebAsset(pathname) {
  const assets = {
    '/': { fileName: 'index.html', contentType: 'text/html; charset=utf-8' },
    '/app.js': { fileName: 'app.js', contentType: 'text/javascript; charset=utf-8' },
    '/styles.css': { fileName: 'styles.css', contentType: 'text/css; charset=utf-8' }
  };
  const asset = assets[pathname];
  if (!asset) throw notFound('ROUTE_NOT_FOUND', 'Route not found.');
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../../web');
  return {
    body: readFileSync(join(webRoot, asset.fileName), 'utf8'),
    contentType: asset.contentType
  };
}

function requiredQuery(url, name) {
  const value = String(url.searchParams.get(name) || '').trim();
  if (!value) {
    const error = new Error(`${name} required.`);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return value;
}

function queryFilters(url) {
  return {
    query: url.searchParams.get('query') || url.searchParams.get('q') || undefined,
    ownerId: url.searchParams.get('ownerId') || undefined,
    projectId: url.searchParams.get('projectId') || undefined,
    listId: url.searchParams.get('listId') || undefined,
    status: url.searchParams.get('status') || undefined,
    tag: url.searchParams.get('tag') || undefined,
    dueBefore: url.searchParams.get('dueBefore') || undefined,
    dueAfter: url.searchParams.get('dueAfter') || undefined,
    includeArchived: url.searchParams.get('includeArchived') === 'true'
  };
}

function notFound(code, message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = code;
  return error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.OWNEROPS_PORT || '3100', 10);
  createOwnerOpsServer().listen(port, () => {
    console.log(`OwnerOps API listening on ${port}`);
  });
}
