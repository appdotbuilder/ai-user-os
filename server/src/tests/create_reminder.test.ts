import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { remindersTable, usersTable, workspacesTable, tasksTable } from '../db/schema';
import { type CreateReminderInput } from '../schema';
import { createReminder } from '../handlers/create_reminder';
import { eq } from 'drizzle-orm';

describe('createReminder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: string;
  let workspaceId: string;
  let taskId: string;

  beforeEach(async () => {
    // Create prerequisite data for testing
    
    // Create user
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
    userId = userResult[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Create task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        description: 'A task for testing',
        status: 'todo',
        priority: 'med',
        assignee_id: userId
      })
      .returning()
      .execute();
    taskId = taskResult[0].id;
  });

  it('should create a reminder with all fields', async () => {
    const remindAt = new Date('2024-12-31T10:00:00Z');
    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: remindAt,
      method: 'email',
      status: 'scheduled'
    };

    const result = await createReminder(testInput);

    // Basic field validation
    expect(result.task_id).toEqual(taskId);
    expect(result.remind_at).toEqual(remindAt);
    expect(result.method).toEqual('email');
    expect(result.status).toEqual('scheduled');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a reminder with default status when not provided', async () => {
    const remindAt = new Date('2024-12-31T15:30:00Z');
    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: remindAt,
      method: 'app_push'
      // status not provided - should default to 'scheduled'
    };

    const result = await createReminder(testInput);

    expect(result.task_id).toEqual(taskId);
    expect(result.remind_at).toEqual(remindAt);
    expect(result.method).toEqual('app_push');
    expect(result.status).toEqual('scheduled'); // Should use default value
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save reminder to database correctly', async () => {
    const remindAt = new Date('2024-12-25T09:00:00Z');
    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: remindAt,
      method: 'calendar',
      status: 'sent'
    };

    const result = await createReminder(testInput);

    // Query database to verify data was saved
    const reminders = await db.select()
      .from(remindersTable)
      .where(eq(remindersTable.id, result.id))
      .execute();

    expect(reminders).toHaveLength(1);
    const savedReminder = reminders[0];
    expect(savedReminder.task_id).toEqual(taskId);
    expect(savedReminder.remind_at).toEqual(remindAt);
    expect(savedReminder.method).toEqual('calendar');
    expect(savedReminder.status).toEqual('sent');
    expect(savedReminder.created_at).toBeInstanceOf(Date);
  });

  it('should handle different reminder methods', async () => {
    const remindAt = new Date('2024-12-20T14:00:00Z');
    
    // Test each valid method
    const methods = ['app_push', 'email', 'calendar'] as const;
    
    for (const method of methods) {
      const testInput: CreateReminderInput = {
        task_id: taskId,
        remind_at: remindAt,
        method: method,
        status: 'scheduled'
      };

      const result = await createReminder(testInput);
      expect(result.method).toEqual(method);
    }
  });

  it('should handle different reminder statuses', async () => {
    const remindAt = new Date('2024-11-15T12:00:00Z');
    
    // Test each valid status
    const statuses = ['scheduled', 'sent', 'cancelled'] as const;
    
    for (const status of statuses) {
      const testInput: CreateReminderInput = {
        task_id: taskId,
        remind_at: remindAt,
        method: 'email',
        status: status
      };

      const result = await createReminder(testInput);
      expect(result.status).toEqual(status);
    }
  });

  it('should throw error when task does not exist', async () => {
    const invalidTaskId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID but non-existent
    const testInput: CreateReminderInput = {
      task_id: invalidTaskId,
      remind_at: new Date('2024-12-31T10:00:00Z'),
      method: 'email',
      status: 'scheduled'
    };

    await expect(createReminder(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });
});