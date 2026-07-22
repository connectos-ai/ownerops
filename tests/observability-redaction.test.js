import test from 'node:test';
import assert from 'node:assert/strict';

import { REDACTED, createSafeLogEvent, redactLogValue, redactString } from '../packages/observability/src/index.js';

test('redactString removes common secret-shaped values and email addresses', () => {
  const bearer = `Bearer ${'ownerops'}-${'secret'}-${'token'}`;
  const slackToken = `${'xo'}${'xb'}-${'1234567890'}-${'secret'}`;
  const googleToken = `${'ya'}${'29'}.${'exampletoken'}`;
  const apiKey = `${'s'}${'k'}-${'abcdefghijklmnopqrstuvwxyz'}`;
  const email = `owner${'@'}example.com`;
  const databaseUrl = `postgres://${'user'}:${'pass'}@localhost:5432/ownerops`;
  const input = [
    `Authorization: ${bearer}`,
    `Slack token ${slackToken}`,
    `Google token ${googleToken}`,
    `OpenAI style ${apiKey}`,
    `Contact ${email}`,
    `Database ${databaseUrl}`
  ].join('\n');

  const output = redactString(input);

  assert.equal(output.includes(bearer), false);
  assert.equal(output.includes(slackToken), false);
  assert.equal(output.includes(email), false);
  assert.equal(output.includes('postgres://user:pass'), false);
  assert.match(output, /\[REDACTED\]/);
});

test('redactLogValue redacts sensitive keys deeply', () => {
  const email = `member${'@'}example.com`;
  const redacted = redactLogValue({
    requestId: 'req_123',
    workspaceId: 'workspace_demo',
    authorization: `Bearer ${'ownerops'}-${'secret'}-${'token'}`,
    nested: {
      emailBody: 'Please send private account details.',
      slackMessage: 'private channel text',
      safeCount: 2
    },
    users: [{ email, displayName: 'Casey' }]
  });

  assert.equal(redacted.requestId, 'req_123');
  assert.equal(redacted.authorization, REDACTED);
  assert.equal(redacted.nested.emailBody, REDACTED);
  assert.equal(redacted.nested.slackMessage, REDACTED);
  assert.equal(redacted.nested.safeCount, 2);
  assert.equal(redacted.users[0].email, REDACTED);
  assert.equal(redacted.users[0].displayName, 'Casey');
});

test('createSafeLogEvent keeps operational metadata and redacts payload', () => {
  const event = createSafeLogEvent({
    requestId: 'req_456',
    workspaceId: 'workspace_demo',
    eventType: 'triage.item_received',
    handler: 'triageEmail',
    durationMs: 42,
    success: false,
    errorClass: 'ValidationError',
    retryCount: 1,
    data: {
      subject: 'Follow up',
      body: 'private message body',
      token: `${'xo'}${'xb'}-${'1234567890'}-${'secret'}`
    }
  });

  assert.equal(event.requestId, 'req_456');
  assert.equal(event.workspaceId, 'workspace_demo');
  assert.equal(event.eventType, 'triage.item_received');
  assert.equal(event.durationMs, 42);
  assert.equal(event.success, false);
  assert.equal(event.errorClass, 'ValidationError');
  assert.equal(event.retryCount, 1);
  assert.equal(event.data.subject, 'Follow up');
  assert.equal(event.data.body, REDACTED);
  assert.equal(event.data.token, REDACTED);
});
