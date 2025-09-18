import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type CreateNoteInput } from '../schema';
import { createNote } from '../handlers/create_note';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4'
};

const testWorkspace = {
  name: 'Test Workspace',
  settings: { theme: 'dark' }
};

const testNoteInput: CreateNoteInput = {
  workspace_id: '', // Will be set in beforeEach
  title: 'Test Note',
  source: 'manual',
  content_md: '# Test Content\nThis is a test note.',
  transcript_text: 'This is a test transcript',
  summary_text: 'This is a test summary',
  entities: { 
    decisions: ['Decision 1'], 
    risks: ['Risk 1'],
    people: ['John Doe'],
    dates: ['2024-01-01']
  },
  created_by: '' // Will be set in beforeEach
};

describe('createNote', () => {
  let userId: string;
  let workspaceId: string;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        ...testWorkspace,
        owner_id: userId
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Set foreign keys in test input
    testNoteInput.workspace_id = workspaceId;
    testNoteInput.created_by = userId;
  });

  afterEach(resetDB);

  it('should create a note with all fields', async () => {
    const result = await createNote(testNoteInput);

    // Verify basic fields
    expect(result.title).toBe('Test Note');
    expect(result.source).toBe('manual');
    expect(result.content_md).toBe('# Test Content\nThis is a test note.');
    expect(result.transcript_text).toBe('This is a test transcript');
    expect(result.summary_text).toBe('This is a test summary');
    expect(result.workspace_id).toBe(workspaceId);
    expect(result.created_by).toBe(userId);
    
    // Verify generated fields
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify entities object
    expect(result.entities).toEqual({
      decisions: ['Decision 1'], 
      risks: ['Risk 1'],
      people: ['John Doe'],
      dates: ['2024-01-01']
    });
  });

  it('should create a note with minimal required fields', async () => {
    const minimalInput: CreateNoteInput = {
      workspace_id: workspaceId,
      title: 'Minimal Note',
      source: 'import',
      content_md: 'Minimal content',
      created_by: userId
    };

    const result = await createNote(minimalInput);

    expect(result.title).toBe('Minimal Note');
    expect(result.source).toBe('import');
    expect(result.content_md).toBe('Minimal content');
    expect(result.transcript_text).toBeNull();
    expect(result.summary_text).toBeNull();
    expect(result.entities).toEqual({});
    expect(result.workspace_id).toBe(workspaceId);
    expect(result.created_by).toBe(userId);
  });

  it('should save note to database', async () => {
    const result = await createNote(testNoteInput);

    // Query the database to verify the note was saved
    const savedNotes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, result.id))
      .execute();

    expect(savedNotes).toHaveLength(1);
    const savedNote = savedNotes[0];
    
    expect(savedNote.title).toBe('Test Note');
    expect(savedNote.source).toBe('manual');
    expect(savedNote.content_md).toBe('# Test Content\nThis is a test note.');
    expect(savedNote.transcript_text).toBe('This is a test transcript');
    expect(savedNote.summary_text).toBe('This is a test summary');
    expect(savedNote.workspace_id).toBe(workspaceId);
    expect(savedNote.created_by).toBe(userId);
    expect(savedNote.entities).toEqual({
      decisions: ['Decision 1'], 
      risks: ['Risk 1'],
      people: ['John Doe'],
      dates: ['2024-01-01']
    });
  });

  it('should handle different source types', async () => {
    const meetingNoteInput: CreateNoteInput = {
      ...testNoteInput,
      source: 'meeting',
      title: 'Meeting Note'
    };

    const result = await createNote(meetingNoteInput);
    expect(result.source).toBe('meeting');
    expect(result.title).toBe('Meeting Note');
  });

  it('should handle null optional fields correctly', async () => {
    const inputWithNulls: CreateNoteInput = {
      workspace_id: workspaceId,
      title: 'Note with nulls',
      source: 'manual',
      content_md: 'Content only',
      transcript_text: null,
      summary_text: null,
      created_by: userId
    };

    const result = await createNote(inputWithNulls);

    expect(result.transcript_text).toBeNull();
    expect(result.summary_text).toBeNull();
    expect(result.entities).toEqual({});
  });

  it('should handle empty entities object', async () => {
    const inputWithEmptyEntities: CreateNoteInput = {
      ...testNoteInput,
      entities: {}
    };

    const result = await createNote(inputWithEmptyEntities);
    expect(result.entities).toEqual({});
  });

  it('should fail with invalid workspace_id', async () => {
    const invalidInput: CreateNoteInput = {
      ...testNoteInput,
      workspace_id: '00000000-0000-4000-8000-000000000000' // Non-existent UUID
    };

    await expect(createNote(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should fail with invalid created_by', async () => {
    const invalidInput: CreateNoteInput = {
      ...testNoteInput,
      created_by: '00000000-0000-4000-8000-000000000000' // Non-existent UUID
    };

    await expect(createNote(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle complex entities structure', async () => {
    const complexEntitiesInput: CreateNoteInput = {
      ...testNoteInput,
      entities: {
        decisions: [
          { title: 'Use React', impact: 'high' },
          { title: 'Deploy on AWS', impact: 'medium' }
        ],
        risks: [
          { description: 'Timeline risk', severity: 'high', mitigation: 'Add buffer' }
        ],
        people: [
          { name: 'John Doe', role: 'Developer' },
          { name: 'Jane Smith', role: 'Designer' }
        ],
        dates: [
          { event: 'Launch date', date: '2024-06-01' },
          { event: 'Beta release', date: '2024-05-01' }
        ],
        custom_field: 'Custom data'
      }
    };

    const result = await createNote(complexEntitiesInput);
    expect(result.entities).toEqual(complexEntitiesInput.entities!);
  });
});