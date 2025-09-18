import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type GetAgentEventsQuery, type CreateUserInput, type CreateWorkspaceInput, type CreateAgentEventInput } from '../schema';
import { getAgentEvents } from '../handlers/get_agent_events';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testUser2: CreateUserInput = {
  email: 'test2@example.com',
  display_name: 'Test User 2',
  timezone: 'UTC',
  llm_provider: 'anthropic',
  llm_model: 'claude-3'
};

describe('getAgentEvents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: string;
  let userId2: string;
  let workspaceId: string;
  let workspaceId2: string;

  beforeEach(async () => {
    // Create test users
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    const userResult2 = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();
    userId2 = userResult2[0].id;

    // Create test workspaces
    const workspaceInput: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Test Workspace',
      settings: { theme: 'dark' }
    };

    const workspaceResult = await db.insert(workspacesTable)
      .values(workspaceInput)
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    const workspaceInput2: CreateWorkspaceInput = {
      owner_id: userId2,
      name: 'Test Workspace 2',
      settings: {}
    };

    const workspaceResult2 = await db.insert(workspacesTable)
      .values(workspaceInput2)
      .returning()
      .execute();
    workspaceId2 = workspaceResult2[0].id;
  });

  it('should return agent events for workspace', async () => {
    // Create test agent events one at a time to ensure proper ordering
    const agentEventInput1: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'task_creator',
      action: 'create_task',
      input: { title: 'New Task', description: 'Task description' },
      output: { task_id: 'task-123' },
      status: 'executed'
    };

    await db.insert(agentEventsTable).values(agentEventInput1).execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const agentEventInput2: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'reminder_scheduler',
      action: 'schedule_reminder',
      input: { task_id: 'task-123', remind_at: '2024-01-15T10:00:00Z' },
      output: { reminder_id: 'reminder-456' },
      status: 'draft'
    };

    await db.insert(agentEventsTable).values(agentEventInput2).execute();

    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(2);
    
    // Results should be ordered by created_at desc (most recent first)
    // The second inserted event should be first (most recent)
    expect(result[0].agent).toEqual('reminder_scheduler');
    expect(result[0].action).toEqual('schedule_reminder');
    expect(result[0].status).toEqual('draft');
    expect(result[0].input).toEqual({ task_id: 'task-123', remind_at: '2024-01-15T10:00:00Z' });
    expect(result[0].output).toEqual({ reminder_id: 'reminder-456' });

    expect(result[1].agent).toEqual('task_creator');
    expect(result[1].action).toEqual('create_task');
    expect(result[1].status).toEqual('executed');
    expect(result[1].input).toEqual({ title: 'New Task', description: 'Task description' });
    expect(result[1].output).toEqual({ task_id: 'task-123' });

    // Verify all results have required fields
    result.forEach(event => {
      expect(event.id).toBeDefined();
      expect(event.workspace_id).toEqual(workspaceId);
      expect(event.created_at).toBeInstanceOf(Date);
    });
  });

  it('should filter by status', async () => {
    // Create agent events with different statuses
    const agentEvents: CreateAgentEventInput[] = [
      {
        workspace_id: workspaceId,
        agent: 'task_creator',
        action: 'create_task',
        input: { title: 'Draft Task' },
        output: {},
        status: 'draft'
      },
      {
        workspace_id: workspaceId,
        agent: 'task_creator',
        action: 'create_task',
        input: { title: 'Executed Task' },
        output: {},
        status: 'executed'
      },
      {
        workspace_id: workspaceId,
        agent: 'task_creator',
        action: 'create_task',
        input: { title: 'Error Task' },
        output: {},
        status: 'error'
      }
    ];

    await db.insert(agentEventsTable).values(agentEvents).execute();

    // Filter for draft status only
    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId,
      status: 'draft'
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('draft');
    expect(result[0].input).toEqual({ title: 'Draft Task' });
  });

  it('should filter by agent', async () => {
    // Create agent events with different agents
    const agentEvents: CreateAgentEventInput[] = [
      {
        workspace_id: workspaceId,
        agent: 'task_creator',
        action: 'create_task',
        input: { title: 'Task Creator Event' },
        output: {}
      },
      {
        workspace_id: workspaceId,
        agent: 'reminder_scheduler',
        action: 'schedule_reminder',
        input: { task_id: 'task-123' },
        output: {}
      },
      {
        workspace_id: workspaceId,
        agent: 'note_summarizer',
        action: 'summarize_note',
        input: { note_id: 'note-456' },
        output: {}
      }
    ];

    await db.insert(agentEventsTable).values(agentEvents).execute();

    // Filter for reminder_scheduler only
    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId,
      agent: 'reminder_scheduler'
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(1);
    expect(result[0].agent).toEqual('reminder_scheduler');
    expect(result[0].action).toEqual('schedule_reminder');
    expect(result[0].input).toEqual({ task_id: 'task-123' });
  });

  it('should filter by both status and agent', async () => {
    // Create agent events with various combinations
    const agentEvents: CreateAgentEventInput[] = [
      {
        workspace_id: workspaceId,
        agent: 'task_creator',
        action: 'create_task',
        input: { title: 'Draft Task' },
        output: {},
        status: 'draft'
      },
      {
        workspace_id: workspaceId,
        agent: 'task_creator',
        action: 'create_task',
        input: { title: 'Executed Task' },
        output: {},
        status: 'executed'
      },
      {
        workspace_id: workspaceId,
        agent: 'reminder_scheduler',
        action: 'schedule_reminder',
        input: { task_id: 'task-123' },
        output: {},
        status: 'draft'
      }
    ];

    await db.insert(agentEventsTable).values(agentEvents).execute();

    // Filter for draft status AND task_creator agent
    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId,
      status: 'draft',
      agent: 'task_creator'
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('draft');
    expect(result[0].agent).toEqual('task_creator');
    expect(result[0].input).toEqual({ title: 'Draft Task' });
  });

  it('should only return events from specified workspace', async () => {
    // Create events in both workspaces
    const workspace1Event: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'task_creator',
      action: 'create_task',
      input: { title: 'Workspace 1 Event' },
      output: {}
    };

    const workspace2Event: CreateAgentEventInput = {
      workspace_id: workspaceId2,
      agent: 'task_creator',
      action: 'create_task',
      input: { title: 'Workspace 2 Event' },
      output: {}
    };

    await db.insert(agentEventsTable).values([
      workspace1Event,
      workspace2Event
    ]).execute();

    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(1);
    expect(result[0].workspace_id).toEqual(workspaceId);
    expect(result[0].input).toEqual({ title: 'Workspace 1 Event' });
  });

  it('should return empty array when no events found', async () => {
    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array when filtering yields no results', async () => {
    // Create an event that won't match the filter
    const agentEvent: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'task_creator',
      action: 'create_task',
      input: { title: 'Test Event' },
      output: {},
      status: 'executed'
    };

    await db.insert(agentEventsTable).values(agentEvent).execute();

    // Query for different status
    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId,
      status: 'draft'
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(0);
  });

  it('should handle complex JSON input and output objects', async () => {
    const complexEvent: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'complex_processor',
      action: 'process_data',
      input: {
        nested: {
          data: ['item1', 'item2'],
          settings: {
            enabled: true,
            threshold: 0.85
          }
        },
        array: [1, 2, 3]
      },
      output: {
        results: {
          processed: 3,
          success: true,
          errors: []
        },
        metadata: {
          duration: '1.5s',
          memory: '128MB'
        }
      },
      status: 'executed'
    };

    await db.insert(agentEventsTable).values(complexEvent).execute();

    const query: GetAgentEventsQuery = {
      workspace_id: workspaceId
    };

    const result = await getAgentEvents(query);

    expect(result).toHaveLength(1);
    expect(result[0].input).toEqual(complexEvent.input);
    expect(result[0].output).toEqual(complexEvent.output!);
    expect(result[0].agent).toEqual('complex_processor');
    expect(result[0].action).toEqual('process_data');
  });
});