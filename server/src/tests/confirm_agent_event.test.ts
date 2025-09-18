import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type UpdateAgentEventInput } from '../schema';
import { confirmAgentEvent } from '../handlers/confirm_agent_event';
import { eq } from 'drizzle-orm';

describe('confirmAgentEvent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update agent event output and status', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable).values({
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    }).returning().execute();

    const workspace = await db.insert(workspacesTable).values({
      owner_id: user[0].id,
      name: 'Test Workspace',
      settings: {}
    }).returning().execute();

    const agentEvent = await db.insert(agentEventsTable).values({
      workspace_id: workspace[0].id,
      agent: 'test-agent',
      action: 'test-action',
      input: { param: 'value' },
      output: {},
      status: 'draft'
    }).returning().execute();

    const updateInput: UpdateAgentEventInput = {
      id: agentEvent[0].id,
      output: { result: 'success', data: 'processed' },
      status: 'executed'
    };

    const result = await confirmAgentEvent(updateInput);

    // Verify the returned data
    expect(result.id).toEqual(agentEvent[0].id);
    expect(result.workspace_id).toEqual(workspace[0].id);
    expect(result.agent).toEqual('test-agent');
    expect(result.action).toEqual('test-action');
    expect(result.input).toEqual({ param: 'value' });
    expect(result.output).toEqual({ result: 'success', data: 'processed' });
    expect(result.status).toEqual('executed');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update only output when status is not provided', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable).values({
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    }).returning().execute();

    const workspace = await db.insert(workspacesTable).values({
      owner_id: user[0].id,
      name: 'Test Workspace',
      settings: {}
    }).returning().execute();

    const agentEvent = await db.insert(agentEventsTable).values({
      workspace_id: workspace[0].id,
      agent: 'test-agent',
      action: 'test-action',
      input: { param: 'value' },
      output: {},
      status: 'awaiting_confirmation'
    }).returning().execute();

    const updateInput: UpdateAgentEventInput = {
      id: agentEvent[0].id,
      output: { result: 'completed' }
    };

    const result = await confirmAgentEvent(updateInput);

    expect(result.output).toEqual({ result: 'completed' });
    expect(result.status).toEqual('awaiting_confirmation'); // Should remain unchanged
  });

  it('should update only status when output is not provided', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable).values({
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    }).returning().execute();

    const workspace = await db.insert(workspacesTable).values({
      owner_id: user[0].id,
      name: 'Test Workspace',
      settings: {}
    }).returning().execute();

    const agentEvent = await db.insert(agentEventsTable).values({
      workspace_id: workspace[0].id,
      agent: 'test-agent',
      action: 'test-action',
      input: { param: 'value' },
      output: { existing: 'data' },
      status: 'draft'
    }).returning().execute();

    const updateInput: UpdateAgentEventInput = {
      id: agentEvent[0].id,
      status: 'error'
    };

    const result = await confirmAgentEvent(updateInput);

    expect(result.output).toEqual({ existing: 'data' }); // Should remain unchanged
    expect(result.status).toEqual('error');
  });

  it('should persist changes to database', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable).values({
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    }).returning().execute();

    const workspace = await db.insert(workspacesTable).values({
      owner_id: user[0].id,
      name: 'Test Workspace',
      settings: {}
    }).returning().execute();

    const agentEvent = await db.insert(agentEventsTable).values({
      workspace_id: workspace[0].id,
      agent: 'test-agent',
      action: 'test-action',
      input: { param: 'value' },
      output: {},
      status: 'draft'
    }).returning().execute();

    const updateInput: UpdateAgentEventInput = {
      id: agentEvent[0].id,
      output: { result: 'success' },
      status: 'executed'
    };

    await confirmAgentEvent(updateInput);

    // Verify the changes were persisted to the database
    const updatedAgentEvent = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, agentEvent[0].id))
      .execute();

    expect(updatedAgentEvent).toHaveLength(1);
    expect(updatedAgentEvent[0].output).toEqual({ result: 'success' });
    expect(updatedAgentEvent[0].status).toEqual('executed');
  });

  it('should throw error when agent event does not exist', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
    
    const updateInput: UpdateAgentEventInput = {
      id: nonExistentId,
      output: { result: 'success' },
      status: 'executed'
    };

    await expect(confirmAgentEvent(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should handle complex output structures', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable).values({
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'anthropic',
      llm_model: 'claude-3'
    }).returning().execute();

    const workspace = await db.insert(workspacesTable).values({
      owner_id: user[0].id,
      name: 'Test Workspace',
      settings: {}
    }).returning().execute();

    const agentEvent = await db.insert(agentEventsTable).values({
      workspace_id: workspace[0].id,
      agent: 'complex-agent',
      action: 'analyze-data',
      input: { dataset: 'test-data', options: { deep: true } },
      output: {},
      status: 'awaiting_confirmation'
    }).returning().execute();

    const complexOutput = {
      analysis: {
        trends: ['trend1', 'trend2'],
        metrics: { accuracy: 0.95, precision: 0.87 },
        insights: [
          { type: 'anomaly', severity: 'high', description: 'Unusual pattern detected' },
          { type: 'correlation', strength: 0.92, variables: ['var1', 'var2'] }
        ]
      },
      metadata: {
        processing_time: 1250,
        model_version: '2.1.0',
        confidence: 0.89
      }
    };

    const updateInput: UpdateAgentEventInput = {
      id: agentEvent[0].id,
      output: complexOutput,
      status: 'executed'
    };

    const result = await confirmAgentEvent(updateInput);

    expect(result.output).toEqual(complexOutput);
    expect(result.status).toEqual('executed');
    
    // Verify complex structure is persisted correctly
    const persisted = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, agentEvent[0].id))
      .execute();

    expect(persisted[0].output).toEqual(complexOutput);
  });
});