import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type CreateAgentEventInput } from '../schema';
import { createAgentEvent } from '../handlers/create_agent_event';
import { eq } from 'drizzle-orm';

// Test data
const testInput: CreateAgentEventInput = {
  workspace_id: '550e8400-e29b-41d4-a716-446655440000',
  agent: 'calendar_agent',
  action: 'schedule_meeting',
  input: {
    title: 'Team Standup',
    duration: 30,
    attendees: ['user1@example.com', 'user2@example.com']
  },
  output: {
    meeting_id: 'meeting-123',
    scheduled_time: '2024-01-15T10:00:00Z'
  },
  status: 'awaiting_confirmation'
};

describe('createAgentEvent', () => {
  let workspaceId: string;

  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite user and workspace
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

    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userResult[0].id,
        name: 'Test Workspace',
        settings: { theme: 'dark' }
      })
      .returning()
      .execute();

    workspaceId = workspaceResult[0].id;
  });

  afterEach(resetDB);

  it('should create an agent event with all fields', async () => {
    const input = { ...testInput, workspace_id: workspaceId };
    const result = await createAgentEvent(input);

    // Basic field validation
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.agent).toEqual('calendar_agent');
    expect(result.action).toEqual('schedule_meeting');
    expect(result.input).toEqual({
      title: 'Team Standup',
      duration: 30,
      attendees: ['user1@example.com', 'user2@example.com']
    });
    expect(result.output).toEqual({
      meeting_id: 'meeting-123',
      scheduled_time: '2024-01-15T10:00:00Z'
    });
    expect(result.status).toEqual('awaiting_confirmation');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create an agent event with default values', async () => {
    const minimalInput: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'email_agent',
      action: 'send_notification',
      input: { recipient: 'user@example.com', message: 'Hello' }
    };

    const result = await createAgentEvent(minimalInput);

    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.agent).toEqual('email_agent');
    expect(result.action).toEqual('send_notification');
    expect(result.input).toEqual({ recipient: 'user@example.com', message: 'Hello' });
    expect(result.output).toEqual({});
    expect(result.status).toEqual('draft');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save agent event to database', async () => {
    const input = { ...testInput, workspace_id: workspaceId };
    const result = await createAgentEvent(input);

    // Query database to verify the record was created
    const agentEvents = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, result.id))
      .execute();

    expect(agentEvents).toHaveLength(1);
    const savedEvent = agentEvents[0];
    
    expect(savedEvent.workspace_id).toEqual(workspaceId);
    expect(savedEvent.agent).toEqual('calendar_agent');
    expect(savedEvent.action).toEqual('schedule_meeting');
    expect(savedEvent.input as Record<string, any>).toEqual({
      title: 'Team Standup',
      duration: 30,
      attendees: ['user1@example.com', 'user2@example.com']
    });
    expect(savedEvent.output as Record<string, any>).toEqual({
      meeting_id: 'meeting-123',
      scheduled_time: '2024-01-15T10:00:00Z'
    });
    expect(savedEvent.status).toEqual('awaiting_confirmation');
    expect(savedEvent.created_at).toBeInstanceOf(Date);
  });

  it('should handle complex JSON input and output', async () => {
    const complexInput: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'data_processor',
      action: 'analyze_metrics',
      input: {
        metrics: ['revenue', 'growth', 'churn'],
        filters: {
          date_range: { start: '2024-01-01', end: '2024-01-31' },
          categories: ['subscription', 'one-time']
        },
        options: { include_forecasts: true, granularity: 'daily' }
      },
      output: {
        results: {
          revenue: { total: 125000, growth: 0.15 },
          metrics_count: 247,
          forecast_accuracy: 0.92
        },
        generated_at: '2024-01-15T14:30:00Z'
      },
      status: 'executed'
    };

    const result = await createAgentEvent(complexInput);

    expect(result.input).toEqual(complexInput.input);
    expect(result.output).toEqual(complexInput.output!);
    expect(result.status).toEqual('executed');

    // Verify in database
    const savedEvents = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, result.id))
      .execute();

    expect(savedEvents[0].input as Record<string, any>).toEqual(complexInput.input);
    expect(savedEvents[0].output as Record<string, any>).toEqual(complexInput.output!);
  });

  it('should handle foreign key constraint violation gracefully', async () => {
    const invalidInput: CreateAgentEventInput = {
      workspace_id: '00000000-0000-0000-0000-000000000000', // Non-existent workspace
      agent: 'test_agent',
      action: 'test_action',
      input: { test: 'data' }
    };

    await expect(createAgentEvent(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });
});