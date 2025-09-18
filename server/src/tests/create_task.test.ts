import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tasksTable, usersTable, workspacesTable, notesTable } from '../db/schema';
import { type CreateTaskInput } from '../schema';
import { createTask } from '../handlers/create_task';
import { eq } from 'drizzle-orm';

describe('createTask', () => {
  let testUserId: string;
  let testWorkspaceId: string;
  let testNoteId: string;

  beforeEach(async () => {
    await createDB();
    
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
    testUserId = userResult[0].id;

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

    // Create test note
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspaceId,
        title: 'Test Note',
        source: 'manual',
        content_md: 'Test content',
        entities: {},
        created_by: testUserId
      })
      .returning()
      .execute();
    testNoteId = noteResult[0].id;
  });

  afterEach(resetDB);

  it('should create a task with all required fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Test Task',
      description: 'A test task description',
      status: 'todo',
      priority: 'high',
      due_at: new Date('2024-12-31T23:59:59Z'),
      assignee_id: testUserId,
      linked_note_id: testNoteId
    };

    const result = await createTask(testInput);

    // Basic field validation
    expect(result.title).toEqual('Test Task');
    expect(result.description).toEqual('A test task description');
    expect(result.status).toEqual('todo');
    expect(result.priority).toEqual('high');
    expect(result.due_at).toBeInstanceOf(Date);
    expect(result.assignee_id).toEqual(testUserId);
    expect(result.linked_note_id).toEqual(testNoteId);
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a task with minimal required fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Minimal Task',
      assignee_id: testUserId
    };

    const result = await createTask(testInput);

    expect(result.title).toEqual('Minimal Task');
    expect(result.description).toBeNull();
    expect(result.status).toEqual('todo'); // Default value
    expect(result.priority).toEqual('med'); // Default value
    expect(result.due_at).toBeNull();
    expect(result.linked_note_id).toBeNull();
    expect(result.assignee_id).toEqual(testUserId);
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save task to database', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Database Test Task',
      assignee_id: testUserId
    };

    const result = await createTask(testInput);

    // Query the database to verify the task was saved
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, result.id))
      .execute();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toEqual('Database Test Task');
    expect(tasks[0].workspace_id).toEqual(testWorkspaceId);
    expect(tasks[0].assignee_id).toEqual(testUserId);
    expect(tasks[0].status).toEqual('todo');
    expect(tasks[0].priority).toEqual('med');
    expect(tasks[0].created_at).toBeInstanceOf(Date);
    expect(tasks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create task with null optional fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Task with nulls',
      description: null,
      due_at: null,
      linked_note_id: null,
      assignee_id: testUserId
    };

    const result = await createTask(testInput);

    expect(result.description).toBeNull();
    expect(result.due_at).toBeNull();
    expect(result.linked_note_id).toBeNull();
    expect(result.title).toEqual('Task with nulls');
    expect(result.status).toEqual('todo'); // Default
    expect(result.priority).toEqual('med'); // Default
  });

  it('should throw error when workspace does not exist', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: '00000000-0000-0000-0000-000000000000',
      title: 'Test Task',
      assignee_id: testUserId
    };

    await expect(createTask(testInput)).rejects.toThrow(/Workspace with id .* not found/);
  });

  it('should throw error when assignee does not exist', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Test Task',
      assignee_id: '00000000-0000-0000-0000-000000000000'
    };

    await expect(createTask(testInput)).rejects.toThrow(/User with id .* not found/);
  });

  it('should throw error when linked note does not exist', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Test Task',
      assignee_id: testUserId,
      linked_note_id: '00000000-0000-0000-0000-000000000000'
    };

    await expect(createTask(testInput)).rejects.toThrow(/Note with id .* not found/);
  });

  it('should throw error when linked note belongs to different workspace', async () => {
    // Create another workspace
    const anotherWorkspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: testUserId,
        name: 'Another Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const anotherWorkspaceId = anotherWorkspaceResult[0].id;

    // Create note in the other workspace
    const noteInOtherWorkspaceResult = await db.insert(notesTable)
      .values({
        workspace_id: anotherWorkspaceId,
        title: 'Note in other workspace',
        source: 'manual',
        content_md: 'Content',
        entities: {},
        created_by: testUserId
      })
      .returning()
      .execute();
    const noteInOtherWorkspaceId = noteInOtherWorkspaceResult[0].id;

    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Test Task',
      assignee_id: testUserId,
      linked_note_id: noteInOtherWorkspaceId
    };

    await expect(createTask(testInput)).rejects.toThrow(/Note .* does not belong to workspace/);
  });

  it('should handle all status and priority enum values', async () => {
    const statusValues = ['todo', 'doing', 'done'] as const;
    const priorityValues = ['low', 'med', 'high'] as const;

    for (const status of statusValues) {
      for (const priority of priorityValues) {
        const testInput: CreateTaskInput = {
          workspace_id: testWorkspaceId,
          title: `Task ${status} ${priority}`,
          status,
          priority,
          assignee_id: testUserId
        };

        const result = await createTask(testInput);
        expect(result.status).toEqual(status);
        expect(result.priority).toEqual(priority);
      }
    }
  });
});