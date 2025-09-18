import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, remindersTable } from '../db/schema';
import { getUpcomingReminders } from '../handlers/get_reminders';

describe('getUpcomingReminders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return upcoming reminders for user tasks', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        assignee_id: userId,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();
    const taskId = taskResult[0].id;

    // Create future reminder
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);
    
    await db.insert(remindersTable)
      .values({
        task_id: taskId,
        remind_at: futureDate,
        method: 'email',
        status: 'scheduled'
      })
      .execute();

    const result = await getUpcomingReminders(userId);

    expect(result).toHaveLength(1);
    expect(result[0].task_id).toEqual(taskId);
    expect(result[0].method).toEqual('email');
    expect(result[0].status).toEqual('scheduled');
    expect(result[0].remind_at).toBeInstanceOf(Date);
    expect(result[0].remind_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('should not return past reminders', async () => {
    // Create test user and workspace
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        assignee_id: userId,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();
    const taskId = taskResult[0].id;

    // Create past reminder
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 2);
    
    await db.insert(remindersTable)
      .values({
        task_id: taskId,
        remind_at: pastDate,
        method: 'email',
        status: 'scheduled'
      })
      .execute();

    const result = await getUpcomingReminders(userId);

    expect(result).toHaveLength(0);
  });

  it('should not return reminders for other users tasks', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        display_name: 'User 1',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const user1Id = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        display_name: 'User 2',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: user1Id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create task assigned to user2
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        assignee_id: user2Id,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();
    const taskId = taskResult[0].id;

    // Create future reminder for user2's task
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);
    
    await db.insert(remindersTable)
      .values({
        task_id: taskId,
        remind_at: futureDate,
        method: 'email',
        status: 'scheduled'
      })
      .execute();

    // Query reminders for user1 (should get none)
    const result = await getUpcomingReminders(user1Id);

    expect(result).toHaveLength(0);
  });

  it('should not return cancelled or sent reminders', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        assignee_id: userId,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();
    const taskId = taskResult[0].id;

    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    // Create cancelled reminder
    await db.insert(remindersTable)
      .values({
        task_id: taskId,
        remind_at: futureDate,
        method: 'email',
        status: 'cancelled'
      })
      .execute();

    // Create sent reminder
    await db.insert(remindersTable)
      .values({
        task_id: taskId,
        remind_at: futureDate,
        method: 'app_push',
        status: 'sent'
      })
      .execute();

    const result = await getUpcomingReminders(userId);

    expect(result).toHaveLength(0);
  });

  it('should return multiple upcoming reminders sorted by remind_at', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create multiple tasks
    const task1Result = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Task 1',
        assignee_id: userId,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();
    const task1Id = task1Result[0].id;

    const task2Result = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Task 2',
        assignee_id: userId,
        status: 'todo',
        priority: 'high'
      })
      .returning()
      .execute();
    const task2Id = task2Result[0].id;

    // Create reminders with different future times
    const futureDate1 = new Date();
    futureDate1.setHours(futureDate1.getHours() + 1);
    
    const futureDate2 = new Date();
    futureDate2.setHours(futureDate2.getHours() + 3);

    await db.insert(remindersTable)
      .values([
        {
          task_id: task1Id,
          remind_at: futureDate2, // Later reminder
          method: 'email',
          status: 'scheduled'
        },
        {
          task_id: task2Id,
          remind_at: futureDate1, // Earlier reminder
          method: 'app_push',
          status: 'scheduled'
        }
      ])
      .execute();

    const result = await getUpcomingReminders(userId);

    expect(result).toHaveLength(2);
    
    // Should include both reminders
    const taskIds = result.map(r => r.task_id);
    expect(taskIds).toContain(task1Id);
    expect(taskIds).toContain(task2Id);
    
    // Verify all have scheduled status
    result.forEach(reminder => {
      expect(reminder.status).toEqual('scheduled');
      expect(reminder.remind_at).toBeInstanceOf(Date);
      expect(reminder.remind_at.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it('should return empty array when no upcoming reminders exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const result = await getUpcomingReminders(userId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});