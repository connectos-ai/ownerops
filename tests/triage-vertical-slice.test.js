import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskPriority, TaskStatus } from '../packages/core/src/index.js';
import { LocalTaskDestination, MockEmailSource } from '../packages/adapters/src/index.js';
import { classifyTextForWork, triageEmailToTaskSuggestion, approveSuggestedTask } from '../packages/triage/src/index.js';

test('deterministic triage detects requested work and owner decisions', () => {
  const result = classifyTextForWork({
    text: 'Can you make sure this is approved before Friday? The budget exception is blocking launch.'
  });

  assert.equal(result.containsWork, true);
  assert.equal(result.ownerDecisionRequired, true);
  assert.equal(result.priority, TaskPriority.HIGH);
  assert.equal(result.recommendedAction, 'suggest_task');
  assert.match(result.explanation, /request/i);
});

test('mock email can become approved task with preserved source and duplicate protection', async () => {
  const email = {
    id: 'email_001',
    subject: 'Follow up needed',
    from: 'customer@example.com',
    receivedAt: '2026-01-01T12:00:00.000Z',
    body: 'Please follow up with the customer by Friday and send a clear answer.'
  };
  const emailSource = new MockEmailSource([email]);
  const destination = new LocalTaskDestination();

  const thread = await emailSource.readThread('email_001');
  const suggestion = triageEmailToTaskSuggestion(thread, {
    workspaceId: 'workspace_demo',
    defaultOwnerId: 'user_owner'
  });

  assert.equal(suggestion.shouldBecomeTask, true);
  assert.equal(suggestion.source.type, 'email');
  assert.equal(suggestion.source.messageId, 'email_001');
  assert.equal(suggestion.task.status, TaskStatus.READY);
  assert.equal(suggestion.task.ownerId, 'user_owner');

  const firstTask = await approveSuggestedTask(suggestion, destination, { actorId: 'user_owner' });
  const duplicateTask = await approveSuggestedTask(suggestion, destination, { actorId: 'user_owner' });

  assert.equal(firstTask.id, duplicateTask.id);
  assert.equal((await destination.listTasks()).length, 1);
});
