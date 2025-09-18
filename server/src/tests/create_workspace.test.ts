import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { workspacesTable, usersTable } from '../db/schema';
import { type CreateWorkspaceInput } from '../schema';
import { createWorkspace } from '../handlers/create_workspace';
import { eq } from 'drizzle-orm';

describe('createWorkspace', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: string;

  // Create a test user before each test since workspace needs owner_id
  beforeEach(async () => {
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    
    userId = userResult[0].id;
  });

  it('should create a workspace with minimal input', async () => {
    const testInput: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Test Workspace'
    };

    const result = await createWorkspace(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Workspace');
    expect(result.owner_id).toEqual(userId);
    expect(result.settings).toEqual({});
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a workspace with custom settings', async () => {
    const testInput: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Advanced Workspace',
      settings: {
        theme: 'dark',
        notifications: true,
        autoSave: false,
        customField: 'value'
      }
    };

    const result = await createWorkspace(testInput);

    expect(result.name).toEqual('Advanced Workspace');
    expect(result.owner_id).toEqual(userId);
    expect(result.settings).toEqual({
      theme: 'dark',
      notifications: true,
      autoSave: false,
      customField: 'value'
    });
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save workspace to database', async () => {
    const testInput: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Database Test Workspace',
      settings: { test: true }
    };

    const result = await createWorkspace(testInput);

    // Query database to verify workspace was saved
    const workspaces = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, result.id))
      .execute();

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toEqual('Database Test Workspace');
    expect(workspaces[0].owner_id).toEqual(userId);
    expect(workspaces[0].settings).toEqual({ test: true });
    expect(workspaces[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle empty settings object', async () => {
    const testInput: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Empty Settings Workspace',
      settings: {}
    };

    const result = await createWorkspace(testInput);

    expect(result.settings).toEqual({});
    expect(typeof result.settings).toBe('object');
  });

  it('should handle complex nested settings', async () => {
    const testInput: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Complex Settings Workspace',
      settings: {
        ui: {
          theme: 'dark',
          language: 'en',
          sidebar: {
            collapsed: false,
            width: 250
          }
        },
        features: {
          aiAssistant: true,
          collaboration: {
            enabled: true,
            maxUsers: 10
          }
        },
        integrations: ['slack', 'github', 'google-calendar']
      }
    };

    const result = await createWorkspace(testInput);

    expect(result.settings).toEqual(testInput.settings!);
    expect((result.settings as any)['ui']['sidebar']['width']).toEqual(250);
    expect((result.settings as any)['integrations']).toHaveLength(3);
  });

  it('should throw error for invalid owner_id', async () => {
    const invalidUserId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format but non-existent
    
    const testInput: CreateWorkspaceInput = {
      owner_id: invalidUserId,
      name: 'Invalid Owner Workspace'
    };

    await expect(createWorkspace(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });
});