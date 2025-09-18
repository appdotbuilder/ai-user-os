import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type GetTasksQuery, type Task } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export const getTasks = async (query: GetTasksQuery): Promise<Task[]> => {
  try {
    // Start with base query
    let baseQuery = db.select().from(tasksTable);

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [
      eq(tasksTable.workspace_id, query.workspace_id)
    ];

    // Apply optional filters
    if (query.status !== undefined) {
      conditions.push(eq(tasksTable.status, query.status));
    }

    if (query.priority !== undefined) {
      conditions.push(eq(tasksTable.priority, query.priority));
    }

    if (query.assignee_id !== undefined) {
      conditions.push(eq(tasksTable.assignee_id, query.assignee_id));
    }

    // Apply where clause with all conditions
    const finalQuery = baseQuery.where(and(...conditions));

    // Execute query
    const results = await finalQuery.execute();

    return results;
  } catch (error) {
    console.error('Get tasks failed:', error);
    throw error;
  }
};