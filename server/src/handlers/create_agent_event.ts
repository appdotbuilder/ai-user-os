import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type CreateAgentEventInput, type AgentEvent } from '../schema';

export const createAgentEvent = async (input: CreateAgentEventInput): Promise<AgentEvent> => {
  try {
    // Insert agent event record
    const result = await db.insert(agentEventsTable)
      .values({
        workspace_id: input.workspace_id,
        agent: input.agent,
        action: input.action,
        input: input.input,
        output: input.output || {},
        status: input.status || 'draft'
      })
      .returning()
      .execute();

    // Type assertion needed because DB JSON fields are typed as unknown
    const agentEvent = result[0];
    return {
      ...agentEvent,
      input: agentEvent.input as Record<string, any>,
      output: agentEvent.output as Record<string, any>
    };
  } catch (error) {
    console.error('Agent event creation failed:', error);
    throw error;
  }
};