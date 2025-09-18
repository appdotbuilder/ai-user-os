import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type UpdateAgentEventInput, type AgentEvent } from '../schema';
import { eq } from 'drizzle-orm';

export const confirmAgentEvent = async (input: UpdateAgentEventInput): Promise<AgentEvent> => {
  try {
    // Update the agent event with new output and status
    const result = await db.update(agentEventsTable)
      .set({
        ...(input.output && { output: input.output }),
        ...(input.status && { status: input.status })
      })
      .where(eq(agentEventsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Agent event with id ${input.id} not found`);
    }

    const agentEvent = result[0];
    return {
      ...agentEvent,
      input: agentEvent.input as Record<string, any>,
      output: agentEvent.output as Record<string, any>
    };
  } catch (error) {
    console.error('Agent event confirmation failed:', error);
    throw error;
  }
};