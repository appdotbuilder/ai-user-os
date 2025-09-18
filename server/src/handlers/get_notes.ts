import { db } from '../db';
import { notesTable } from '../db/schema';
import { type GetNotesQuery, type Note } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export const getNotes = async (query: GetNotesQuery): Promise<Note[]> => {
  try {
    // Build conditions array for optional filters
    const conditions: SQL<unknown>[] = [];

    // Always filter by workspace_id (required field)
    conditions.push(eq(notesTable.workspace_id, query.workspace_id));

    // Add optional source filter
    if (query.source) {
      conditions.push(eq(notesTable.source, query.source));
    }

    // Add optional created_by filter
    if (query.created_by) {
      conditions.push(eq(notesTable.created_by, query.created_by));
    }

    // Build and execute query
    const results = await db.select()
      .from(notesTable)
      .where(and(...conditions))
      .orderBy(desc(notesTable.created_at))
      .execute();

    // Convert entities field to proper type and return results
    return results.map(note => ({
      ...note,
      entities: note.entities as Record<string, any>
    }));
  } catch (error) {
    console.error('Get notes failed:', error);
    throw error;
  }
};