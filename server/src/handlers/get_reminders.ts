import { db } from '../db';
import { remindersTable, tasksTable } from '../db/schema';
import { type Reminder } from '../schema';
import { eq, and, gte } from 'drizzle-orm';

export const getUpcomingReminders = async (userId: string): Promise<Reminder[]> => {
  try {
    const now = new Date();
    
    // Join reminders with tasks to filter by assignee_id
    const results = await db.select({
      id: remindersTable.id,
      task_id: remindersTable.task_id,
      remind_at: remindersTable.remind_at,
      method: remindersTable.method,
      status: remindersTable.status,
      created_at: remindersTable.created_at,
    })
      .from(remindersTable)
      .innerJoin(tasksTable, eq(remindersTable.task_id, tasksTable.id))
      .where(
        and(
          eq(tasksTable.assignee_id, userId),
          gte(remindersTable.remind_at, now),
          eq(remindersTable.status, 'scheduled')
        )
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get upcoming reminders:', error);
    throw error;
  }
};