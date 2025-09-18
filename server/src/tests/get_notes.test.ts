import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type GetNotesQuery } from '../schema';
import { getNotes } from '../handlers/get_notes';
import { eq } from 'drizzle-orm';

describe('getNotes', () => {
  let userId1: string;
  let userId2: string;
  let workspaceId1: string;
  let workspaceId2: string;
  let noteId1: string;
  let noteId2: string;
  let noteId3: string;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          display_name: 'User One',
          timezone: 'UTC',
          llm_provider: 'openai',
          llm_model: 'gpt-4'
        },
        {
          email: 'user2@test.com',
          display_name: 'User Two',
          timezone: 'UTC',
          llm_provider: 'anthropic',
          llm_model: 'claude-3'
        }
      ])
      .returning({ id: usersTable.id })
      .execute();

    userId1 = users[0].id;
    userId2 = users[1].id;

    // Create test workspaces
    const workspaces = await db.insert(workspacesTable)
      .values([
        {
          owner_id: userId1,
          name: 'Test Workspace 1',
          settings: { theme: 'dark' }
        },
        {
          owner_id: userId2,
          name: 'Test Workspace 2',
          settings: { theme: 'light' }
        }
      ])
      .returning({ id: workspacesTable.id })
      .execute();

    workspaceId1 = workspaces[0].id;
    workspaceId2 = workspaces[1].id;

    // Create test notes with different sources and creators
    const notes = await db.insert(notesTable)
      .values([
        {
          workspace_id: workspaceId1,
          title: 'Manual Note',
          source: 'manual',
          content_md: '# Manual Note Content',
          transcript_text: null,
          summary_text: 'Summary of manual note',
          entities: { decisions: [], risks: [] },
          created_by: userId1
        },
        {
          workspace_id: workspaceId1,
          title: 'Meeting Note',
          source: 'meeting',
          content_md: '# Meeting Notes',
          transcript_text: 'Meeting transcript here...',
          summary_text: 'Meeting summary',
          entities: { decisions: ['Decision 1'], risks: ['Risk 1'] },
          created_by: userId2
        },
        {
          workspace_id: workspaceId2,
          title: 'Import Note',
          source: 'import',
          content_md: '# Imported Content',
          transcript_text: null,
          summary_text: null,
          entities: {},
          created_by: userId2
        }
      ])
      .returning({ id: notesTable.id })
      .execute();

    noteId1 = notes[0].id;
    noteId2 = notes[1].id;
    noteId3 = notes[2].id;
  });

  afterEach(resetDB);

  it('should get all notes from a workspace', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId1
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(2);
    expect(result[0].workspace_id).toBe(workspaceId1);
    expect(result[1].workspace_id).toBe(workspaceId1);
    
    // Verify ordering (newest first)
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(result[1].created_at.getTime());
    
    // Verify all required fields are present
    result.forEach(note => {
      expect(note.id).toBeDefined();
      expect(note.workspace_id).toBe(workspaceId1);
      expect(note.title).toBeDefined();
      expect(note.source).toBeDefined();
      expect(note.content_md).toBeDefined();
      expect(note.entities).toBeDefined();
      expect(note.created_by).toBeDefined();
      expect(note.created_at).toBeInstanceOf(Date);
      expect(note.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should filter notes by source', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId1,
      source: 'manual'
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Manual Note');
    expect(result[0].source).toBe('manual');
    expect(result[0].created_by).toBe(userId1);
  });

  it('should filter notes by creator', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId1,
      created_by: userId2
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting Note');
    expect(result[0].source).toBe('meeting');
    expect(result[0].created_by).toBe(userId2);
  });

  it('should filter by both source and creator', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId1,
      source: 'meeting',
      created_by: userId2
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting Note');
    expect(result[0].source).toBe('meeting');
    expect(result[0].created_by).toBe(userId2);
  });

  it('should return empty array when no matches found', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId1,
      source: 'import' // No import notes in workspace1
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent workspace', async () => {
    const query: GetNotesQuery = {
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' // Non-existent UUID
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(0);
  });

  it('should handle notes with null optional fields', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId2
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Import Note');
    expect(result[0].transcript_text).toBeNull();
    expect(result[0].summary_text).toBeNull();
    expect(result[0].entities).toEqual({});
  });

  it('should verify notes are ordered by created_at descending', async () => {
    // Add a delay and create another note to test ordering
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await db.insert(notesTable)
      .values({
        workspace_id: workspaceId1,
        title: 'Newest Note',
        source: 'manual',
        content_md: '# Latest content',
        created_by: userId1
      })
      .execute();

    const query: GetNotesQuery = {
      workspace_id: workspaceId1
    };

    const result = await getNotes(query);

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Newest Note');
    
    // Verify descending order
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].created_at.getTime()).toBeGreaterThanOrEqual(
        result[i + 1].created_at.getTime()
      );
    }
  });

  it('should save notes correctly in database', async () => {
    const query: GetNotesQuery = {
      workspace_id: workspaceId1
    };

    const result = await getNotes(query);

    // Verify notes exist in database by querying directly
    const dbNotes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.workspace_id, workspaceId1))
      .execute();

    expect(dbNotes).toHaveLength(2);
    expect(result).toHaveLength(2);
    
    // Verify each note from handler matches database
    result.forEach(handlerNote => {
      const dbNote = dbNotes.find(n => n.id === handlerNote.id);
      expect(dbNote).toBeDefined();
      expect(dbNote?.title).toBe(handlerNote.title);
      expect(dbNote?.source).toBe(handlerNote.source);
      expect(dbNote?.content_md).toBe(handlerNote.content_md);
    });
  });
});