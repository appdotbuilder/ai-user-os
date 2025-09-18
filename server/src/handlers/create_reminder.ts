import { db } from '../db';
import { remindersTable } from '../db/schema';
import { type CreateReminderInput, type Reminder } from '../schema';

export const createReminder = async (input: CreateReminderInput): Promise<Reminder> => {
  try {
    // Insert reminder record
    const result = await db.insert(remindersTable)
      .values({
        task_id: input.task_id,
        remind_at: input.remind_at,
        method: input.method,
        status: input.status || 'scheduled' // Use default if not provided
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Reminder creation failed:', error);
    throw error;
  }
};