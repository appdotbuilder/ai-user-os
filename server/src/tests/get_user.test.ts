import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUser } from '../handlers/get_user';

// Test user data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'America/New_York',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

describe('getUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when user exists', async () => {
    // Create a test user first
    const createdUsers = await db.insert(usersTable)
      .values(testUserInput)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    // Fetch the user
    const result = await getUser(createdUser.id);

    // Verify result
    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdUser.id);
    expect(result!.email).toBe(testUserInput.email);
    expect(result!.display_name).toBe(testUserInput.display_name);
    expect(result!.timezone).toBe(testUserInput.timezone);
    expect(result!.llm_provider).toBe(testUserInput.llm_provider);
    expect(result!.llm_model).toBe(testUserInput.llm_model);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null when user does not exist', async () => {
    const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const result = await getUser(nonExistentId);

    expect(result).toBeNull();
  });

  it('should return correct user from multiple users', async () => {
    // Create multiple test users
    const user1Input = {
      ...testUserInput,
      email: 'user1@example.com',
      display_name: 'User One'
    };

    const user2Input = {
      ...testUserInput,
      email: 'user2@example.com',
      display_name: 'User Two'
    };

    const createdUsers = await db.insert(usersTable)
      .values([user1Input, user2Input])
      .returning()
      .execute();

    const user1 = createdUsers[0];
    const user2 = createdUsers[1];

    // Fetch user1
    const result1 = await getUser(user1.id);
    expect(result1).not.toBeNull();
    expect(result1!.id).toBe(user1.id);
    expect(result1!.display_name).toBe('User One');

    // Fetch user2
    const result2 = await getUser(user2.id);
    expect(result2).not.toBeNull();
    expect(result2!.id).toBe(user2.id);
    expect(result2!.display_name).toBe('User Two');
  });

  it('should handle malformed UUID gracefully', async () => {
    const malformedId = 'not-a-valid-uuid';
    
    // This should throw an error due to invalid UUID format
    await expect(getUser(malformedId)).rejects.toThrow();
  });

  it('should return user with all LLM provider options', async () => {
    const providers = ['openai', 'anthropic', 'google'] as const;
    
    for (const provider of providers) {
      const userInput = {
        ...testUserInput,
        email: `${provider}@example.com`,
        llm_provider: provider
      };

      const createdUsers = await db.insert(usersTable)
        .values(userInput)
        .returning()
        .execute();

      const createdUser = createdUsers[0];
      const result = await getUser(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.llm_provider).toBe(provider);
    }
  });
});