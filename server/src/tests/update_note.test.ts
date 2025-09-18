import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type UpdateNoteInput, type CreateUserInput, type CreateWorkspaceInput, type CreateNoteInput } from '../schema';
import { updateNote } from '../handlers/update_note';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testWorkspace: CreateWorkspaceInput = {
  owner_id: '', // Will be set after user creation
  name: 'Test Workspace',
  settings: { theme: 'dark' }
};

const testNote: CreateNoteInput = {
  workspace_id: '', // Will be set after workspace creation
  title: 'Original Title',
  source: 'manual',
  content_md: '# Original Content',
  transcript_text: 'Original transcript',
  summary_text: 'Original summary',
  entities: { decisions: ['decision1'], risks: ['risk1'] },
  created_by: '' // Will be set after user creation
};

describe('updateNote', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update note title', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id,
      title: 'Updated Title'
    };

    const result = await updateNote(updateInput);

    expect(result.id).toEqual(note.id);
    expect(result.title).toEqual('Updated Title');
    expect(result.content_md).toEqual('# Original Content'); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > note.updated_at).toBe(true);
  });

  it('should update note content', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id,
      content_md: '# Updated Content\n\nThis is new content.'
    };

    const result = await updateNote(updateInput);

    expect(result.id).toEqual(note.id);
    expect(result.content_md).toEqual('# Updated Content\n\nThis is new content.');
    expect(result.title).toEqual('Original Title'); // Unchanged
  });

  it('should update AI processing fields', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id,
      summary_text: 'AI-generated summary of the meeting content',
      entities: {
        decisions: ['Use React for frontend', 'Deploy on AWS'],
        risks: ['Budget overrun', 'Timeline delay'],
        people: ['John Smith', 'Jane Doe'],
        dates: ['2024-01-15', '2024-02-01']
      }
    };

    const result = await updateNote(updateInput);

    expect(result.id).toEqual(note.id);
    expect(result.summary_text).toEqual('AI-generated summary of the meeting content');
    expect(result.entities).toEqual({
      decisions: ['Use React for frontend', 'Deploy on AWS'],
      risks: ['Budget overrun', 'Timeline delay'],
      people: ['John Smith', 'Jane Doe'],
      dates: ['2024-01-15', '2024-02-01']
    });
    expect(result.title).toEqual('Original Title'); // Unchanged
    expect(result.content_md).toEqual('# Original Content'); // Unchanged
  });

  it('should update multiple fields simultaneously', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id,
      title: 'Meeting Summary - Q4 Planning',
      transcript_text: 'Updated transcript with better accuracy',
      summary_text: 'Comprehensive summary of Q4 planning decisions',
      entities: {
        decisions: ['Increase marketing budget', 'Hire 3 developers'],
        risks: ['Market volatility'],
        action_items: ['Review budget by Friday', 'Post job descriptions']
      }
    };

    const result = await updateNote(updateInput);

    expect(result.id).toEqual(note.id);
    expect(result.title).toEqual('Meeting Summary - Q4 Planning');
    expect(result.transcript_text).toEqual('Updated transcript with better accuracy');
    expect(result.summary_text).toEqual('Comprehensive summary of Q4 planning decisions');
    expect(result.entities).toEqual({
      decisions: ['Increase marketing budget', 'Hire 3 developers'],
      risks: ['Market volatility'],
      action_items: ['Review budget by Friday', 'Post job descriptions']
    });
    expect(result.content_md).toEqual('# Original Content'); // Unchanged
  });

  it('should handle null values correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id,
      transcript_text: null,
      summary_text: null
    };

    const result = await updateNote(updateInput);

    expect(result.id).toEqual(note.id);
    expect(result.transcript_text).toBeNull();
    expect(result.summary_text).toBeNull();
  });

  it('should persist changes to database', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id,
      title: 'Persisted Title Update'
    };

    await updateNote(updateInput);

    // Verify changes were persisted
    const [updatedNote] = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, note.id))
      .execute();

    expect(updatedNote.title).toEqual('Persisted Title Update');
    expect(updatedNote.updated_at).toBeInstanceOf(Date);
    expect(updatedNote.updated_at > note.updated_at).toBe(true);
  });

  it('should throw error for non-existent note', async () => {
    const updateInput: UpdateNoteInput = {
      id: '00000000-0000-0000-0000-000000000000',
      title: 'This should fail'
    };

    await expect(updateNote(updateInput)).rejects.toThrow(/Note with ID .+ not found/i);
  });

  it('should handle empty update gracefully', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [workspace] = await db.insert(workspacesTable).values({
      ...testWorkspace,
      owner_id: user.id
    }).returning().execute();
    const [note] = await db.insert(notesTable).values({
      ...testNote,
      workspace_id: workspace.id,
      created_by: user.id
    }).returning().execute();

    const updateInput: UpdateNoteInput = {
      id: note.id
    };

    const result = await updateNote(updateInput);

    // Only updated_at should change
    expect(result.id).toEqual(note.id);
    expect(result.title).toEqual('Original Title');
    expect(result.content_md).toEqual('# Original Content');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > note.updated_at).toBe(true);
  });
});