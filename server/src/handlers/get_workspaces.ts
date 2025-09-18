import { db } from '../db';
import { workspacesTable } from '../db/schema';
import { type Workspace } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserWorkspaces = async (userId: string): Promise<Workspace[]> => {
  try {
    // Fetch all workspaces where user is the owner
    const results = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.owner_id, userId))
      .execute();

    // Cast settings from unknown to Record<string, any> to match schema type
    return results.map(workspace => ({
      ...workspace,
      settings: workspace.settings as Record<string, any>
    }));
  } catch (error) {
    console.error('Failed to fetch user workspaces:', error);
    throw error;
  }
};