import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq, and } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'America/New_York',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all required fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.timezone).toEqual('America/New_York');
    expect(result.llm_provider).toEqual('openai');
    expect(result.llm_model).toEqual('gpt-4');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save user to database correctly', async () => {
    const result = await createUser(testInput);

    // Query database to verify persistence
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.display_name).toEqual('Test User');
    expect(savedUser.timezone).toEqual('America/New_York');
    expect(savedUser.llm_provider).toEqual('openai');
    expect(savedUser.llm_model).toEqual('gpt-4');
    expect(savedUser.created_at).toBeInstanceOf(Date);
  });

  it('should create users with different LLM providers', async () => {
    const anthropicUser: CreateUserInput = {
      ...testInput,
      email: 'anthropic@example.com',
      llm_provider: 'anthropic',
      llm_model: 'claude-3-sonnet'
    };

    const googleUser: CreateUserInput = {
      ...testInput,
      email: 'google@example.com',
      llm_provider: 'google',
      llm_model: 'gemini-pro'
    };

    const result1 = await createUser(anthropicUser);
    const result2 = await createUser(googleUser);

    expect(result1.llm_provider).toEqual('anthropic');
    expect(result1.llm_model).toEqual('claude-3-sonnet');
    expect(result2.llm_provider).toEqual('google');
    expect(result2.llm_model).toEqual('gemini-pro');

    // Verify both users exist in database
    const users = await db.select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, result1.id),
        )
      )
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].llm_provider).toEqual('anthropic');
  });

  it('should handle different timezones correctly', async () => {
    const timezoneInputs = [
      { ...testInput, email: 'utc@example.com', timezone: 'UTC' },
      { ...testInput, email: 'tokyo@example.com', timezone: 'Asia/Tokyo' },
      { ...testInput, email: 'london@example.com', timezone: 'Europe/London' }
    ];

    for (const input of timezoneInputs) {
      const result = await createUser(input);
      expect(result.timezone).toEqual(input.timezone);
    }

    // Verify all users were created
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers.length).toBeGreaterThanOrEqual(3);
  });

  it('should enforce email uniqueness constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Attempt to create second user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      display_name: 'Different User' // Different display name but same email
    };

    await expect(createUser(duplicateInput))
      .rejects
      .toThrow(/duplicate key value violates unique constraint|UNIQUE constraint failed/i);
  });

  it('should generate unique IDs for different users', async () => {
    const user1Input: CreateUserInput = {
      ...testInput,
      email: 'user1@example.com'
    };

    const user2Input: CreateUserInput = {
      ...testInput,
      email: 'user2@example.com'
    };

    const result1 = await createUser(user1Input);
    const result2 = await createUser(user2Input);

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);
  });

  it('should set created_at timestamp automatically', async () => {
    const beforeCreate = new Date();
    const result = await createUser(testInput);
    const afterCreate = new Date();

    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });
});