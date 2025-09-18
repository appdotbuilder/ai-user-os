import { db } from '../db';
import { notesTable } from '../db/schema';
import { type UpdateNoteInput, type Note } from '../schema';
import { eq } from 'drizzle-orm';

export const updateNote = async (input: UpdateNoteInput): Promise<Note> => {
  try {
    // Build update object with only provided fields
    const updateData: Partial<{
      title: string;
      content_md: string;
      transcript_text: string | null;
      summary_text: string | null;
      entities: Record<string, any>;
      updated_at: Date;
    }> = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }

    if (input.content_md !== undefined) {
      updateData.content_md = input.content_md;
    }

    if (input.transcript_text !== undefined) {
      updateData.transcript_text = input.transcript_text;
    }

    if (input.summary_text !== undefined) {
      updateData.summary_text = input.summary_text;
    }

    if (input.entities !== undefined) {
      updateData.entities = input.entities;
    }

    // Update the note
    const result = await db.update(notesTable)
      .set(updateData)
      .where(eq(notesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Note with ID ${input.id} not found`);
    }

    const note = result[0];
    return {
      ...note,
      entities: note.entities as Record<string, any>
    };
  } catch (error) {
    console.error('Note update failed:', error);
    throw error;
  }
};