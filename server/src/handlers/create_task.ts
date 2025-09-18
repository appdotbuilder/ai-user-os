import { db } from '../db';
import { tasksTable, usersTable, workspacesTable, notesTable } from '../db/schema';
import { type CreateTaskInput, type Task } from '../schema';
import { eq } from 'drizzle-orm';

export const createTask = async (input: CreateTaskInput): Promise<Task> => {
  try {
    // Verify that the workspace exists
    const workspace = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, input.workspace_id))
      .execute();
    
    if (workspace.length === 0) {
      throw new Error(`Workspace with id ${input.workspace_id} not found`);
    }

    // Verify that the assignee user exists
    const assignee = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.assignee_id))
      .execute();
    
    if (assignee.length === 0) {
      throw new Error(`User with id ${input.assignee_id} not found`);
    }

    // If linked_note_id is provided, verify that the note exists and belongs to the same workspace
    if (input.linked_note_id) {
      const note = await db.select()
        .from(notesTable)
        .where(eq(notesTable.id, input.linked_note_id))
        .execute();
      
      if (note.length === 0) {
        throw new Error(`Note with id ${input.linked_note_id} not found`);
      }
      
      if (note[0].workspace_id !== input.workspace_id) {
        throw new Error(`Note ${input.linked_note_id} does not belong to workspace ${input.workspace_id}`);
      }
    }

    // Insert task record
    const result = await db.insert(tasksTable)
      .values({
        workspace_id: input.workspace_id,
        title: input.title,
        description: input.description || null,
        status: input.status || 'todo',
        priority: input.priority || 'med',
        due_at: input.due_at || null,
        assignee_id: input.assignee_id,
        linked_note_id: input.linked_note_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task creation failed:', error);
    throw error;
  }
};