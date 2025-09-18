import { db } from '../db';
import { tasksTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateTaskInput, type Task } from '../schema';

export const updateTask = async (input: UpdateTaskInput): Promise<Task> => {
  try {
    // Build update data, only including defined fields
    const updateData: any = {};
    
    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }
    if (input.due_at !== undefined) {
      updateData.due_at = input.due_at;
    }
    if (input.assignee_id !== undefined) {
      updateData.assignee_id = input.assignee_id;
    }
    if (input.linked_note_id !== undefined) {
      updateData.linked_note_id = input.linked_note_id;
    }

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Update the task record
    const result = await db.update(tasksTable)
      .set(updateData)
      .where(eq(tasksTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Task with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Task update failed:', error);
    throw error;
  }
};