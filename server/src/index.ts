import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createWorkspaceInputSchema,
  createNoteInputSchema,
  updateNoteInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  createReminderInputSchema,
  createAgentEventInputSchema,
  updateAgentEventInputSchema,
  getTasksQuerySchema,
  getNotesQuerySchema,
  getAgentEventsQuerySchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUser } from './handlers/get_user';
import { createWorkspace } from './handlers/create_workspace';
import { getUserWorkspaces } from './handlers/get_workspaces';
import { createNote } from './handlers/create_note';
import { getNotes } from './handlers/get_notes';
import { updateNote } from './handlers/update_note';
import { createTask } from './handlers/create_task';
import { getTasks } from './handlers/get_tasks';
import { updateTask } from './handlers/update_task';
import { createReminder } from './handlers/create_reminder';
import { getUpcomingReminders } from './handlers/get_reminders';
import { createAgentEvent } from './handlers/create_agent_event';
import { getAgentEvents } from './handlers/get_agent_events';
import { confirmAgentEvent } from './handlers/confirm_agent_event';
import { transcribeMeetingChunk } from './handlers/transcribe_meeting';
import { finalizeMeeting } from './handlers/finalize_meeting';
import { createCalendarDraft } from './handlers/calendar_draft';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getUser: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(({ input }) => getUser(input.userId)),

  // Workspace management
  createWorkspace: publicProcedure
    .input(createWorkspaceInputSchema)
    .mutation(({ input }) => createWorkspace(input)),

  getUserWorkspaces: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(({ input }) => getUserWorkspaces(input.userId)),

  // Notes management
  createNote: publicProcedure
    .input(createNoteInputSchema)
    .mutation(({ input }) => createNote(input)),

  getNotes: publicProcedure
    .input(getNotesQuerySchema)
    .query(({ input }) => getNotes(input)),

  updateNote: publicProcedure
    .input(updateNoteInputSchema)
    .mutation(({ input }) => updateNote(input)),

  // Tasks management
  createTask: publicProcedure
    .input(createTaskInputSchema)
    .mutation(({ input }) => createTask(input)),

  getTasks: publicProcedure
    .input(getTasksQuerySchema)
    .query(({ input }) => getTasks(input)),

  updateTask: publicProcedure
    .input(updateTaskInputSchema)
    .mutation(({ input }) => updateTask(input)),

  // Reminders management
  createReminder: publicProcedure
    .input(createReminderInputSchema)
    .mutation(({ input }) => createReminder(input)),

  getUpcomingReminders: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(({ input }) => getUpcomingReminders(input.userId)),

  // Agent events (SilentTray)
  createAgentEvent: publicProcedure
    .input(createAgentEventInputSchema)
    .mutation(({ input }) => createAgentEvent(input)),

  getAgentEvents: publicProcedure
    .input(getAgentEventsQuerySchema)
    .query(({ input }) => getAgentEvents(input)),

  confirmAgentEvent: publicProcedure
    .input(updateAgentEventInputSchema)
    .mutation(({ input }) => confirmAgentEvent(input)),

  // Meeting transcription
  transcribeMeetingChunk: publicProcedure
    .input(z.object({
      audio_chunk: z.instanceof(ArrayBuffer).or(z.instanceof(Uint8Array)),
      workspace_id: z.string().uuid(),
      session_id: z.string().optional()
    }))
    .mutation(({ input }) => transcribeMeetingChunk(input)),

  finalizeMeeting: publicProcedure
    .input(z.object({
      note_id: z.string().uuid(),
      final_transcript: z.string().optional()
    }))
    .mutation(({ input }) => finalizeMeeting(input)),

  // Calendar integration
  createCalendarDraft: publicProcedure
    .input(z.object({
      title: z.string(),
      start: z.coerce.date(),
      end: z.coerce.date(),
      attendees: z.array(z.string()).optional(),
      description: z.string().optional(),
      workspace_id: z.string().uuid()
    }))
    .mutation(({ input }) => createCalendarDraft(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();