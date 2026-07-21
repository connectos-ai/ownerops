import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerOpsServer } from '../apps/api/src/server.js';

test('serves standalone web task manager shell without integrations', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.match(html, /OwnerOps/);
    assert.match(html, /id="task-form"/);
    assert.match(html, /data-view="kanban"/);
    assert.match(html, /data-form="comment"/);
    assert.match(html, /data-form="subtask"/);
    assert.match(html, /Add comment/);
    assert.match(html, /Add subtask/);
    assert.match(html, /data-action="ARCHIVE"/);
    assert.match(html, /data-action="REOPEN"/);
    assert.match(html, /app\.js/);
    assert.match(html, /without Slack, email, AI, DoBoth, or ConnectOS/i);
    assert.doesNotMatch(html, /Slack app required/i);
  } finally {
    await closeServer(server);
  }
});

test('serves standalone web assets with no private content', async () => {
  const app = createOwnerOpsServer();
  const server = app.listen(0);
  await onceListening(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const script = await fetch(`${baseUrl}/app.js`);
    const style = await fetch(`${baseUrl}/styles.css`);
    const js = await script.text();
    const css = await style.text();

    assert.equal(script.status, 200);
    assert.equal(style.status, 200);
    assert.match(script.headers.get('content-type') || '', /javascript/);
    assert.match(style.headers.get('content-type') || '', /text\/css/);
    assert.match(js, /createTask/);
    assert.match(js, /includeArchived=true/);
    assert.match(css, /task-board/);
    assert.doesNotMatch(`${js}\n${css}`, /xox[baprs]-|ya29\.|api[_-]?key|access[_-]?token/i);
  } finally {
    await closeServer(server);
  }
});

async function onceListening(server) {
  return new Promise((resolve) => server.once('listening', resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
