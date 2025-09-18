import { db } from '../db';
import { notesTable } from '../db/schema';
import { type CreateNoteInput, type Note } from '../schema';

export const createNote = async (input: CreateNoteInput): Promise<Note> => {
  try {
    // Insert note record
    const result = await db.insert(notesTable)
      .values({
        workspace_id: input.workspace_id,
        title: input.title,
        source: input.source,
        content_md: input.content_md,
        transcript_text: input.transcript_text || null,
        summary_text: input.summary_text || null,
        entities: input.entities || {},
        created_by: input.created_by
      })
      .returning()
      .execute();

    // Convert the result to match the schema type
    const note = result[0];
    return {
      ...note,
      entities: note.entities as Record<string, any>
    };
  } catch (error) {
    console.error('Note creation failed:', error);
    throw error;
  }
};