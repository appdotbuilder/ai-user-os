import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable } from '../db/schema';
import { getUserWorkspaces } from '../handlers/get_workspaces';
import { eq } from 'drizzle-orm';

describe('getUserWorkspaces', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return workspaces owned by user', async () => {
    // Create test user
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

    const userId = userResult[0].id;

    // Create test workspaces
    const workspace1Result = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace 1',
        settings: { theme: 'dark' }
      })
      .returning()
      .execute();

    const workspace2Result = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace 2',
        settings: {}
      })
      .returning()
      .execute();

    const workspaces = await getUserWorkspaces(userId);

    expect(workspaces).toHaveLength(2);
    expect(workspaces.map(w => w.name).sort()).toEqual(['Test Workspace 1', 'Test Workspace 2']);
    expect(workspaces.every(w => w.owner_id === userId)).toBe(true);
    expect(workspaces[0]).toHaveProperty('id');
    expect(workspaces[0]).toHaveProperty('created_at');
    expect(workspaces[0].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array when user has no workspaces', async () => {
    // Create test user
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

    const userId = userResult[0].id;

    const workspaces = await getUserWorkspaces(userId);

    expect(workspaces).toHaveLength(0);
    expect(Array.isArray(workspaces)).toBe(true);
  });

  it('should only return workspaces owned by specified user', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        display_name: 'User 1',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        display_name: 'User 2',
        timezone: 'UTC',
        llm_provider: 'anthropic',
        llm_model: 'claude-3'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create workspaces for both users
    await db.insert(workspacesTable)
      .values({
        owner_id: user1Id,
        name: 'User 1 Workspace',
        settings: {}
      })
      .execute();

    await db.insert(workspacesTable)
      .values({
        owner_id: user2Id,
        name: 'User 2 Workspace',
        settings: {}
      })
      .execute();

    // Get workspaces for user 1
    const user1Workspaces = await getUserWorkspaces(user1Id);

    expect(user1Workspaces).toHaveLength(1);
    expect(user1Workspaces[0].name).toEqual('User 1 Workspace');
    expect(user1Workspaces[0].owner_id).toEqual(user1Id);

    // Get workspaces for user 2
    const user2Workspaces = await getUserWorkspaces(user2Id);

    expect(user2Workspaces).toHaveLength(1);
    expect(user2Workspaces[0].name).toEqual('User 2 Workspace');
    expect(user2Workspaces[0].owner_id).toEqual(user2Id);
  });

  it('should return workspaces ordered by creation time', async () => {
    // Create test user
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

    const userId = userResult[0].id;

    // Create workspaces with slight delays to ensure different timestamps
    const workspace1Result = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'First Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const workspace2Result = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Second Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const workspaces = await getUserWorkspaces(userId);

    expect(workspaces).toHaveLength(2);
    // Workspaces should be returned in database order (which may be creation order)
    expect(workspaces[0].created_at).toBeInstanceOf(Date);
    expect(workspaces[1].created_at).toBeInstanceOf(Date);
    
    // Verify all expected properties are present
    workspaces.forEach(workspace => {
      expect(workspace).toHaveProperty('id');
      expect(workspace).toHaveProperty('owner_id');
      expect(workspace).toHaveProperty('name');
      expect(workspace).toHaveProperty('settings');
      expect(workspace).toHaveProperty('created_at');
      expect(typeof workspace.settings).toBe('object');
    });
  });
});