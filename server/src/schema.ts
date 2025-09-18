import { z } from 'zod';

// Enum schemas
export const sourceSchema = z.enum(['manual', 'meeting', 'import']);
export const statusSchema = z.enum(['todo', 'doing', 'done']);
export const prioritySchema = z.enum(['low', 'med', 'high']);
export const methodSchema = z.enum(['app_push', 'email', 'calendar']);
export const reminderStatusSchema = z.enum(['scheduled', 'sent', 'cancelled']);
export const agentEventStatusSchema = z.enum(['draft', 'awaiting_confirmation', 'executed', 'error']);
export const userRoleSchema = z.enum(['owner', 'member']);
export const llmProviderSchema = z.enum(['openai', 'anthropic', 'google']);

// User schema
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  timezone: z.string(),
  llm_provider: llmProviderSchema,
  llm_model: z.string(),
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Workspace schema
export const workspaceSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  settings: z.record(z.any()), // JSON object
  created_at: z.coerce.date()
});

export type Workspace = z.infer<typeof workspaceSchema>;

// Note schema
export const noteSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string(),
  source: sourceSchema,
  content_md: z.string(),
  transcript_text: z.string().nullable(),
  summary_text: z.string().nullable(),
  entities: z.record(z.any()), // JSON object for decisions, risks, people, dates
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Note = z.infer<typeof noteSchema>;

// Task schema
export const taskSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: statusSchema,
  priority: prioritySchema,
  due_at: z.coerce.date().nullable(),
  assignee_id: z.string().uuid(),
  linked_note_id: z.string().uuid().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Task = z.infer<typeof taskSchema>;

// Reminder schema
export const reminderSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  remind_at: z.coerce.date(),
  method: methodSchema,
  status: reminderStatusSchema,
  created_at: z.coerce.date()
});

export type Reminder = z.infer<typeof reminderSchema>;

// Agent Event schema
export const agentEventSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.any()), // JSON object
  output: z.record(z.any()), // JSON object
  status: agentEventStatusSchema,
  created_at: z.coerce.date()
});

export type AgentEvent = z.infer<typeof agentEventSchema>;

// Input schemas for creating entities
export const createUserInputSchema = z.object({
  email: z.string().email(),
  display_name: z.string(),
  timezone: z.string(),
  llm_provider: llmProviderSchema,
  llm_model: z.string()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createWorkspaceInputSchema = z.object({
  owner_id: z.string().uuid(),
  name: z.string(),
  settings: z.record(z.any()).optional()
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

export const createNoteInputSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string(),
  source: sourceSchema,
  content_md: z.string(),
  transcript_text: z.string().nullable().optional(),
  summary_text: z.string().nullable().optional(),
  entities: z.record(z.any()).optional(),
  created_by: z.string().uuid()
});

export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;

export const createTaskInputSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  due_at: z.coerce.date().nullable().optional(),
  assignee_id: z.string().uuid(),
  linked_note_id: z.string().uuid().nullable().optional()
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const createReminderInputSchema = z.object({
  task_id: z.string().uuid(),
  remind_at: z.coerce.date(),
  method: methodSchema,
  status: reminderStatusSchema.optional()
});

export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;

export const createAgentEventInputSchema = z.object({
  workspace_id: z.string().uuid(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.any()),
  output: z.record(z.any()).optional(),
  status: agentEventStatusSchema.optional()
});

export type CreateAgentEventInput = z.infer<typeof createAgentEventInputSchema>;

// Update schemas
export const updateTaskInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  due_at: z.coerce.date().nullable().optional(),
  assignee_id: z.string().uuid().optional(),
  linked_note_id: z.string().uuid().nullable().optional()
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const updateNoteInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  content_md: z.string().optional(),
  transcript_text: z.string().nullable().optional(),
  summary_text: z.string().nullable().optional(),
  entities: z.record(z.any()).optional()
});

export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;

export const updateAgentEventInputSchema = z.object({
  id: z.string().uuid(),
  output: z.record(z.any()).optional(),
  status: agentEventStatusSchema.optional()
});

export type UpdateAgentEventInput = z.infer<typeof updateAgentEventInputSchema>;

// Query schemas
export const getTasksQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assignee_id: z.string().uuid().optional()
});

export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;

export const getNotesQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  source: sourceSchema.optional(),
  created_by: z.string().uuid().optional()
});

export type GetNotesQuery = z.infer<typeof getNotesQuerySchema>;

export const getAgentEventsQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  status: agentEventStatusSchema.optional(),
  agent: z.string().optional()
});

export type GetAgentEventsQuery = z.infer<typeof getAgentEventsQuerySchema>;