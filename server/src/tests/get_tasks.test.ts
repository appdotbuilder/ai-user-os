import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, notesTable } from '../db/schema';
import { type GetTasksQuery } from '../schema';
import { getTasks } from '../handlers/get_tasks';

// Test data setup
const testUser = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4'
};

const testWorkspace = {
  name: 'Test Workspace',
  settings: { theme: 'light' }
};

const testNote = {
  title: 'Test Note',
  source: 'manual' as const,
  content_md: 'Test content',
  transcript_text: null,
  summary_text: null,
  entities: { decisions: [] }
};

describe('getTasks', () => {
  let userId: string;
  let workspaceId: string;
  let noteId: string;
  let secondUserId: string;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create second test user for assignee filtering tests
    const secondUserResult = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'test2@example.com',
        display_name: 'Second User'
      })
      .returning()
      .execute();
    secondUserId = secondUserResult[0].id;

    // Create test workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        ...testWorkspace,
        owner_id: userId
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Create test note for linking
    const noteResult = await db.insert(notesTable)
      .values({
        ...testNote,
        workspace_id: workspaceId,
        created_by: userId
      })
      .returning()
      .execute();
    noteId = noteResult[0].id;
  });

  afterEach(resetDB);

  it('should get all tasks from workspace when no filters applied', async () => {
    // Create multiple tasks with different statuses and priorities
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Task 1',
          description: 'First task',
          status: 'todo',
          priority: 'high',
          assignee_id: userId,
          linked_note_id: noteId
        },
        {
          workspace_id: workspaceId,
          title: 'Task 2',
          description: 'Second task',
          status: 'doing',
          priority: 'med',
          assignee_id: secondUserId,
          linked_note_id: null
        },
        {
          workspace_id: workspaceId,
          title: 'Task 3',
          description: null,
          status: 'done',
          priority: 'low',
          assignee_id: userId,
          linked_note_id: null
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(3);
    expect(results[0].title).toBe('Task 1');
    expect(results[1].title).toBe('Task 2');
    expect(results[2].title).toBe('Task 3');
    expect(results[0].workspace_id).toBe(workspaceId);
  });

  it('should filter tasks by status', async () => {
    // Create tasks with different statuses
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Todo Task',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Doing Task',
          status: 'doing',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Done Task',
          status: 'done',
          priority: 'med',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      status: 'doing'
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Doing Task');
    expect(results[0].status).toBe('doing');
  });

  it('should filter tasks by priority', async () => {
    // Create tasks with different priorities
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'High Priority Task',
          status: 'todo',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Medium Priority Task',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Low Priority Task',
          status: 'todo',
          priority: 'low',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      priority: 'high'
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('High Priority Task');
    expect(results[0].priority).toBe('high');
  });

  it('should filter tasks by assignee', async () => {
    // Create tasks assigned to different users
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Task for User 1',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Task for User 2',
          status: 'todo',
          priority: 'med',
          assignee_id: secondUserId
        },
        {
          workspace_id: workspaceId,
          title: 'Another Task for User 1',
          status: 'doing',
          priority: 'high',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      assignee_id: userId
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Task for User 1');
    expect(results[1].title).toBe('Another Task for User 1');
    expect(results[0].assignee_id).toBe(userId);
    expect(results[1].assignee_id).toBe(userId);
  });

  it('should apply multiple filters simultaneously', async () => {
    // Create tasks with various combinations of filters
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'High Priority Todo for User 1',
          status: 'todo',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'High Priority Doing for User 1',
          status: 'doing',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Low Priority Todo for User 1',
          status: 'todo',
          priority: 'low',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'High Priority Todo for User 2',
          status: 'todo',
          priority: 'high',
          assignee_id: secondUserId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      status: 'todo',
      priority: 'high',
      assignee_id: userId
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('High Priority Todo for User 1');
    expect(results[0].status).toBe('todo');
    expect(results[0].priority).toBe('high');
    expect(results[0].assignee_id).toBe(userId);
  });

  it('should return empty array when no tasks match filters', async () => {
    // Create a task that won't match our filter
    await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Todo Task',
        status: 'todo',
        priority: 'med',
        assignee_id: userId
      })
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      status: 'done' // Filter for done tasks when only todo exists
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(0);
  });

  it('should return empty array for non-existent workspace', async () => {
    // Create a task in our test workspace
    await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        status: 'todo',
        priority: 'med',
        assignee_id: userId
      })
      .execute();

    const query: GetTasksQuery = {
      workspace_id: '00000000-0000-0000-0000-000000000000' // Non-existent workspace
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(0);
  });

  it('should handle tasks with all optional fields populated', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Complete Task',
        description: 'Task with all fields',
        status: 'doing',
        priority: 'high',
        due_at: futureDate,
        assignee_id: userId,
        linked_note_id: noteId
      })
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Complete Task');
    expect(results[0].description).toBe('Task with all fields');
    expect(results[0].status).toBe('doing');
    expect(results[0].priority).toBe('high');
    expect(results[0].due_at).toBeInstanceOf(Date);
    expect(results[0].assignee_id).toBe(userId);
    expect(results[0].linked_note_id).toBe(noteId);
    expect(results[0].created_at).toBeInstanceOf(Date);
    expect(results[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle tasks with null optional fields', async () => {
    await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Minimal Task',
        description: null,
        status: 'todo',
        priority: 'med',
        due_at: null,
        assignee_id: userId,
        linked_note_id: null
      })
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const results = await getTasks(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Minimal Task');
    expect(results[0].description).toBeNull();
    expect(results[0].due_at).toBeNull();
    expect(results[0].linked_note_id).toBeNull();
  });
});