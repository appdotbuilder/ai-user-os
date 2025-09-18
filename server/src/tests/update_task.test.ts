import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, notesTable } from '../db/schema';
import { type UpdateTaskInput } from '../schema';
import { updateTask } from '../handlers/update_task';
import { eq } from 'drizzle-orm';

describe('updateTask', () => {
  let testUserId: string;
  let testWorkspaceId: string;
  let testTaskId: string;
  let testAssigneeId: string;
  let testNoteId: string;

  beforeEach(async () => {
    await createDB();

    // Create test user (owner)
    const userResult = await db.insert(usersTable)
      .values({
        email: 'owner@test.com',
        display_name: 'Test Owner',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test assignee
    const assigneeResult = await db.insert(usersTable)
      .values({
        email: 'assignee@test.com',
        display_name: 'Test Assignee',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    testAssigneeId = assigneeResult[0].id;

    // Create test workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: testUserId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    testWorkspaceId = workspaceResult[0].id;

    // Create test note for linking
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspaceId,
        title: 'Test Note',
        source: 'manual',
        content_md: 'Test note content',
        entities: {},
        created_by: testUserId
      })
      .returning()
      .execute();
    testNoteId = noteResult[0].id;

    // Create initial test task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: testWorkspaceId,
        title: 'Original Task',
        description: 'Original description',
        status: 'todo',
        priority: 'low',
        due_at: new Date('2024-01-15'),
        assignee_id: testUserId,
        linked_note_id: null
      })
      .returning()
      .execute();
    testTaskId = taskResult[0].id;
  });

  afterEach(resetDB);

  it('should update task title', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Updated Task Title'
    };

    const result = await updateTask(input);

    expect(result.id).toEqual(testTaskId);
    expect(result.title).toEqual('Updated Task Title');
    expect(result.description).toEqual('Original description'); // Should remain unchanged
    expect(result.status).toEqual('todo'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
  });

  it('should update task status and priority', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      status: 'doing',
      priority: 'high'
    };

    const result = await updateTask(input);

    expect(result.status).toEqual('doing');
    expect(result.priority).toEqual('high');
    expect(result.title).toEqual('Original Task'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update due date', async () => {
    const newDueDate = new Date('2024-02-20T10:00:00Z');
    const input: UpdateTaskInput = {
      id: testTaskId,
      due_at: newDueDate
    };

    const result = await updateTask(input);

    expect(result.due_at).toEqual(newDueDate);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update assignee', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      assignee_id: testAssigneeId
    };

    const result = await updateTask(input);

    expect(result.assignee_id).toEqual(testAssigneeId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update linked note', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      linked_note_id: testNoteId
    };

    const result = await updateTask(input);

    expect(result.linked_note_id).toEqual(testNoteId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set description to null when explicitly provided', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      description: null
    };

    const result = await updateTask(input);

    expect(result.description).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set due_at to null when explicitly provided', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      due_at: null
    };

    const result = await updateTask(input);

    expect(result.due_at).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set linked_note_id to null when explicitly provided', async () => {
    // First set a linked note
    await db.update(tasksTable)
      .set({ linked_note_id: testNoteId })
      .where(eq(tasksTable.id, testTaskId))
      .execute();

    const input: UpdateTaskInput = {
      id: testTaskId,
      linked_note_id: null
    };

    const result = await updateTask(input);

    expect(result.linked_note_id).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields at once', async () => {
    const newDueDate = new Date('2024-03-01T14:30:00Z');
    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Multi-Update Task',
      description: 'Updated description',
      status: 'done',
      priority: 'high',
      due_at: newDueDate,
      assignee_id: testAssigneeId,
      linked_note_id: testNoteId
    };

    const result = await updateTask(input);

    expect(result.title).toEqual('Multi-Update Task');
    expect(result.description).toEqual('Updated description');
    expect(result.status).toEqual('done');
    expect(result.priority).toEqual('high');
    expect(result.due_at).toEqual(newDueDate);
    expect(result.assignee_id).toEqual(testAssigneeId);
    expect(result.linked_note_id).toEqual(testNoteId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should persist changes to database', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Persisted Title',
      status: 'doing'
    };

    await updateTask(input);

    // Query database directly to verify persistence
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, testTaskId))
      .execute();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toEqual('Persisted Title');
    expect(tasks[0].status).toEqual('doing');
    expect(tasks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when task not found', async () => {
    const input: UpdateTaskInput = {
      id: '00000000-0000-0000-0000-000000000000',
      title: 'Should Fail'
    };

    await expect(updateTask(input)).rejects.toThrow(/not found/i);
  });

  it('should only update updated_at when no other fields provided', async () => {
    const originalTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, testTaskId))
      .execute();

    const input: UpdateTaskInput = {
      id: testTaskId
    };

    const result = await updateTask(input);

    expect(result.title).toEqual(originalTask[0].title);
    expect(result.description).toEqual(originalTask[0].description);
    expect(result.status).toEqual(originalTask[0].status);
    expect(result.priority).toEqual(originalTask[0].priority);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTask[0].updated_at.getTime());
  });

  it('should handle foreign key constraints for assignee_id', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      assignee_id: '00000000-0000-0000-0000-000000000001'
    };

    await expect(updateTask(input)).rejects.toThrow();
  });

  it('should handle foreign key constraints for linked_note_id', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      linked_note_id: '00000000-0000-0000-0000-000000000002'
    };

    await expect(updateTask(input)).rejects.toThrow();
  });
});