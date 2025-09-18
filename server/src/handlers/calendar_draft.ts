import { db } from '../db';
import { agentEventsTable } from '../db/schema';

export interface CalendarDraftInput {
    title: string;
    start: Date;
    end: Date;
    attendees?: string[];
    description?: string;
    workspace_id: string;
}

export interface CalendarEventDraft {
    id: string;
    title: string;
    start: Date;
    end: Date;
    attendees: string[];
    description?: string;
    calendar_link?: string;
    status: 'draft';
}

export const createCalendarDraft = async (input: CalendarDraftInput): Promise<CalendarEventDraft> => {
    try {
        // Create agent event to track the calendar draft creation
        const agentEventResult = await db.insert(agentEventsTable)
            .values({
                workspace_id: input.workspace_id,
                agent: 'calendar_integration',
                action: 'create_draft_event',
                input: {
                    title: input.title,
                    start: input.start.toISOString(),
                    end: input.end.toISOString(),
                    attendees: input.attendees || [],
                    description: input.description || null
                },
                output: {},
                status: 'awaiting_confirmation'
            })
            .returning()
            .execute();

        const agentEvent = agentEventResult[0];

        // Generate calendar link (placeholder for Google Calendar integration)
        const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(input.title)}&dates=${input.start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${input.end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&details=${encodeURIComponent(input.description || '')}&ctz=UTC`;

        // Return the calendar draft event
        return {
            id: agentEvent.id,
            title: input.title,
            start: input.start,
            end: input.end,
            attendees: input.attendees || [],
            description: input.description,
            calendar_link: calendarLink,
            status: 'draft'
        };
    } catch (error) {
        console.error('Calendar draft creation failed:', error);
        throw error;
    }
};