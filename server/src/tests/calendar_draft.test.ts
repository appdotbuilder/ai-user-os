import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type CalendarDraftInput } from '../handlers/calendar_draft';
import { createCalendarDraft } from '../handlers/calendar_draft';

// Test data setup
let testUser: any;
let testWorkspace: any;

const createTestData = async () => {
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
    
    testUser = userResult[0];

    // Create test workspace
    const workspaceResult = await db.insert(workspacesTable)
        .values({
            owner_id: testUser.id,
            name: 'Test Workspace',
            settings: {}
        })
        .returning()
        .execute();
    
    testWorkspace = workspaceResult[0];
};

// Sample calendar draft input
const testInput: CalendarDraftInput = {
    title: 'Team Meeting',
    start: new Date('2024-01-15T10:00:00Z'),
    end: new Date('2024-01-15T11:00:00Z'),
    attendees: ['john@example.com', 'jane@example.com'],
    description: 'Weekly team sync meeting',
    workspace_id: ''
};

describe('createCalendarDraft', () => {
    beforeEach(async () => {
        await createDB();
        await createTestData();
        testInput.workspace_id = testWorkspace.id;
    });
    
    afterEach(resetDB);

    it('should create a calendar draft event', async () => {
        const result = await createCalendarDraft(testInput);

        // Validate basic fields
        expect(result.title).toBe('Team Meeting');
        expect(result.start).toEqual(testInput.start);
        expect(result.end).toEqual(testInput.end);
        expect(result.attendees).toEqual(['john@example.com', 'jane@example.com']);
        expect(result.description).toBe('Weekly team sync meeting');
        expect(result.status).toBe('draft');
        expect(result.id).toBeDefined();
        expect(result.calendar_link).toContain('https://calendar.google.com');
    });

    it('should handle minimal input without attendees and description', async () => {
        const minimalInput: CalendarDraftInput = {
            title: 'Simple Meeting',
            start: new Date('2024-01-16T14:00:00Z'),
            end: new Date('2024-01-16T15:00:00Z'),
            workspace_id: testWorkspace.id
        };

        const result = await createCalendarDraft(minimalInput);

        expect(result.title).toBe('Simple Meeting');
        expect(result.attendees).toEqual([]);
        expect(result.description).toBeUndefined();
        expect(result.status).toBe('draft');
        expect(result.calendar_link).toContain('https://calendar.google.com');
    });

    it('should create agent event in database', async () => {
        const result = await createCalendarDraft(testInput);

        // Query the created agent event
        const agentEvents = await db.select()
            .from(agentEventsTable)
            .where(eq(agentEventsTable.id, result.id))
            .execute();

        expect(agentEvents).toHaveLength(1);
        
        const agentEvent = agentEvents[0];
        expect(agentEvent.workspace_id).toBe(testWorkspace.id);
        expect(agentEvent.agent).toBe('calendar_integration');
        expect(agentEvent.action).toBe('create_draft_event');
        expect(agentEvent.status).toBe('awaiting_confirmation');
        expect(agentEvent.created_at).toBeInstanceOf(Date);

        // Validate input data structure
        expect(agentEvent.input).toMatchObject({
            title: 'Team Meeting',
            start: testInput.start.toISOString(),
            end: testInput.end.toISOString(),
            attendees: ['john@example.com', 'jane@example.com'],
            description: 'Weekly team sync meeting'
        });
    });

    it('should generate valid Google Calendar link', async () => {
        const result = await createCalendarDraft(testInput);

        expect(result.calendar_link).toContain('https://calendar.google.com/calendar/render');
        expect(result.calendar_link).toContain('action=TEMPLATE');
        expect(result.calendar_link).toContain(encodeURIComponent('Team Meeting'));
        expect(result.calendar_link).toContain('20240115T100000Z');
        expect(result.calendar_link).toContain('20240115T110000Z');
        expect(result.calendar_link).toContain(encodeURIComponent('Weekly team sync meeting'));
    });

    it('should handle empty attendees array correctly', async () => {
        const inputWithEmptyAttendees = {
            ...testInput,
            attendees: []
        };

        const result = await createCalendarDraft(inputWithEmptyAttendees);

        expect(result.attendees).toEqual([]);
        
        // Check agent event input
        const agentEvents = await db.select()
            .from(agentEventsTable)
            .where(eq(agentEventsTable.id, result.id))
            .execute();

        expect(agentEvents[0].input).toMatchObject({
            attendees: []
        });
    });

    it('should handle future dates correctly', async () => {
        const futureInput: CalendarDraftInput = {
            title: 'Future Meeting',
            start: new Date('2025-12-31T23:30:00Z'),
            end: new Date('2026-01-01T00:30:00Z'),
            workspace_id: testWorkspace.id
        };

        const result = await createCalendarDraft(futureInput);

        expect(result.start).toEqual(futureInput.start);
        expect(result.end).toEqual(futureInput.end);
        expect(result.calendar_link).toContain('20251231T233000Z');
        expect(result.calendar_link).toContain('20260101T003000Z');
    });

    it('should store null description in agent event when description is undefined', async () => {
        const inputWithoutDescription = {
            title: 'No Description Meeting',
            start: new Date('2024-01-20T16:00:00Z'),
            end: new Date('2024-01-20T17:00:00Z'),
            workspace_id: testWorkspace.id
        };

        const result = await createCalendarDraft(inputWithoutDescription);

        const agentEvents = await db.select()
            .from(agentEventsTable)
            .where(eq(agentEventsTable.id, result.id))
            .execute();

        expect(agentEvents[0].input).toMatchObject({
            description: null
        });
    });
});