import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskPriority,
  TaskStatus,
  createWorkspace,
  addWorkspaceUser,
  createTask,
  assignTask,
  addCollaborator,
  changeTaskStatus,
  requestOwnerDecision,
  resolveOwnerDecision,
  groupTasksForKanban,
  generateDailyBrief,
  generateWeeklyReview
} from '../packages/core/src/index.js';

test('standalone workspace supports task ownership and status flow', () => {
  const workspace = createWorkspace({ id: 'workspace_demo', name: 'Demo Team' });
  const owner = addWorkspaceUser(workspace, { id: 'user_owner', displayName: 'Owner' });
  const teammate = addWorkspaceUser(workspace, { id: 'user_ops', displayName: 'Ops Lead' });

  let task = createTask({
    id: 'task_follow_up',
    workspaceId: workspace.id,
    title: 'Follow up with customer',
    desiredOutcome: 'Customer has a clear answer',
    createdBy: owner.id,
    ownerId: owner.id,
    priority: TaskPriority.HIGH,
    dueAt: '2026-01-02T15:00:00.000Z',
    sourceType: 'manual'
  });

  task = assignTask(task, teammate.id, { actorId: owner.id });
  task = addCollaborator(task, owner.id, { actorId: teammate.id });
  task = changeTaskStatus(task, TaskStatus.IN_PROGRESS, { actorId: teammate.id });
  task = changeTaskStatus(task, TaskStatus.WAITING, { actorId: teammate.id, waitingOn: 'Customer reply' });
  task = changeTaskStatus(task, TaskStatus.BLOCKED, { actorId: teammate.id, blockedReason: 'Missing account number' });
  task = changeTaskStatus(task, TaskStatus.DONE, { actorId: teammate.id });

  assert.equal(task.ownerId, teammate.id);
  assert.deepEqual(task.collaborators, [owner.id]);
  assert.equal(task.status, TaskStatus.DONE);
  assert.ok(task.completedAt);
  assert.equal(task.history.at(-1).eventType, 'task.completed');
});

test('owner decisions are explicit and resolvable', () => {
  let task = createTask({
    id: 'task_contract',
    workspaceId: 'workspace_demo',
    title: 'Decide whether to approve contract',
    createdBy: 'user_ops',
    ownerId: 'user_owner'
  });

  task = requestOwnerDecision(task, {
    actorId: 'user_ops',
    reason: 'Contract approval requires owner authorization',
    recommendedChoice: 'Approve after legal review',
    alternatives: ['Approve now', 'Reject', 'Ask for revisions']
  });

  assert.equal(task.status, TaskStatus.NEEDS_OWNER);
  assert.equal(task.ownerDecisionRequired, true);
  assert.match(task.ownerDecisionReason, /authorization/);

  task = resolveOwnerDecision(task, {
    actorId: 'user_owner',
    decision: 'Ask for revisions'
  });

  assert.equal(task.status, TaskStatus.READY);
  assert.equal(task.ownerDecisionRequired, false);
  assert.equal(task.history.at(-1).eventType, 'task.owner_decision_resolved');
});

test('kanban and briefs are derived from canonical task data', () => {
  const tasks = [
    createTask({ id: 'task_today', workspaceId: 'workspace_demo', title: 'Prepare agenda', createdBy: 'user_owner', ownerId: 'user_owner', dueAt: '2026-01-02T09:00:00.000Z' }),
    changeTaskStatus(createTask({ id: 'task_blocked', workspaceId: 'workspace_demo', title: 'Confirm vendor', createdBy: 'user_owner', ownerId: 'user_ops' }), TaskStatus.BLOCKED, { actorId: 'user_ops', blockedReason: 'Waiting on quote' }),
    requestOwnerDecision(createTask({ id: 'task_decision', workspaceId: 'workspace_demo', title: 'Approve expense', createdBy: 'user_ops', ownerId: 'user_owner' }), { actorId: 'user_ops', reason: 'Financial authorization required' }),
    changeTaskStatus(createTask({ id: 'task_done', workspaceId: 'workspace_demo', title: 'Send recap', createdBy: 'user_owner', ownerId: 'user_ops' }), TaskStatus.DONE, { actorId: 'user_ops' })
  ];

  const board = groupTasksForKanban(tasks);
  assert.equal(board.INBOX.length, 1);
  assert.equal(board.BLOCKED.length, 1);
  assert.equal(board.NEEDS_OWNER.length, 1);
  assert.equal(board.DONE.length, 1);

  const dailyBrief = generateDailyBrief(tasks, { now: '2026-01-02T08:00:00.000Z' });
  assert.deepEqual(dailyBrief.dueToday.map((task) => task.id), ['task_today']);
  assert.deepEqual(dailyBrief.blocked.map((task) => task.id), ['task_blocked']);
  assert.deepEqual(dailyBrief.needsOwner.map((task) => task.id), ['task_decision']);
  assert.deepEqual(dailyBrief.completed.map((task) => task.id), ['task_done']);

  const weeklyReview = generateWeeklyReview(tasks);
  assert.equal(weeklyReview.completed.length, 1);
  assert.equal(weeklyReview.ownerBottlenecks.length, 1);
  assert.equal(weeklyReview.repeatedBlockers.length, 1);
});
