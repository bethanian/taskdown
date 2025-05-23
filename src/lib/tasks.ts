
// src/lib/tasks.ts

import { supabase } from './supabaseClient'; // Assuming supabaseClient.ts exports a 'supabase' instance
import { PostgrestError } from '@supabase/supabase-js';
import type { RecurrenceRule } from './types'; // Import RecurrenceRule

// Define the Task type based on the schema in taskdown.md
export interface Task {
  id: string; // uuid
  created_at: string; // timestamp
  update_at: string; // timestamp
  title: string; // text, NOT NULL
  completed: boolean; // bool, default: false
  priority: string; // text, default: "none"
  status: string; // text, default: "To Do"
  due_date?: string | null; // timestamp, nullable
  notes?: string | null; // text, nullable
  tags?: any[] | null; // jsonb, default: '[]'
  assigned_to?: string | null; // text, nullable
  share_id?: string | null; // text, nullable (used for view-only public sharing)
  parent_id?: string | null; // uuid, nullable (FK to tasks.id for subtasks)
  attachments?: any | null; // jsonb, nullable
  user_id?: string | null; // uuid, nullable (FK to auth.users.id)
  recurrence: RecurrenceRule; // text, default: "none"
  dependent_on?: string | null; // uuid, nullable (FK to tasks.id for dependencies)
}

// Type for the fields that can be updated in editTask
// Making most fields optional as we might only update some of them
export type TaskUpdate = Partial<Omit<Task, 'id' | 'created_at' | 'update_at' | 'user_id'>>;


/**
 * Edits an existing task.
 * @param taskId The ID of the task to edit.
 * @param updates An object containing the fields to update.
 * @returns The updated task data.
 * @throws Error if the task is not found or if there's an update error.
 */
export async function editTask(
  taskId: string,
  updates: TaskUpdate
): Promise<{ data: Task | null; error: PostgrestError | null }> {
  if (!taskId) {
    return { data: null, error: { message: 'Task ID is required.', details: '', hint: '', code: '400' } as PostgrestError };
  }
  // Check if updates object is empty. If so, return early to avoid unnecessary DB call.
  if (Object.keys(updates).length === 0) {
    // Consider this not an error, but a no-op.
    // You might want to return the existing task or a specific message.
    // For now, returning a custom "error-like" object to indicate no operation.
    return { data: null, error: { message: 'No updates provided.', details: 'Update object was empty.', hint: 'No database operation was performed.', code: '204' } as PostgrestError };
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, update_at: new Date().toISOString() }) // Ensure update_at is always updated
    .eq('id', taskId)
    .select()
    .single(); // .single() assumes the ID is unique and will return one row or an error

  if (error) {
    // It's better to log a string representation of the error details,
    // as the raw error object sometimes stringifies to "{}" in the Next.js overlay.
    const errorDetailsString = `Code: ${error.code || 'N/A'}, Message: ${error.message || 'N/A'}, Details: ${error.details || 'N/A'}, Hint: ${error.hint || 'N/A'}`;
    let userAdvice = "";
    if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
      userAdvice = "ADVICE: This might be due to a stale schema cache in Supabase or the column not existing in the database. Try reloading the schema in your Supabase dashboard (Project Settings > API > Reload schema) or ensure the column is correctly migrated.";
    }
    console.error(`Error editing task (ID: ${taskId}): ${errorDetailsString}. ${userAdvice}`, error);
  }
  return { data: data as Task | null, error };
}

/**
 * Toggles the completion status of a task.
 * @param taskId The ID of the task to toggle.
 * @param currentStatus The current completion status of the task.
 * @returns The updated task data.
 * @throws Error if the task is not found or if there's an update error.
 */
export async function toggleComplete(
  taskId: string,
  currentStatus: boolean
): Promise<{ data: Task | null; error: PostgrestError | null }> {
  if (!taskId) {
    return { data: null, error: { message: 'Task ID is required.', details: '', hint: '', code: '400' } as PostgrestError };
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ completed: !currentStatus, update_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    const errorDetailsString = `Code: ${error.code || 'N/A'}, Message: ${error.message || 'N/A'}, Details: ${error.details || 'N/A'}, Hint: ${error.hint || 'N/A'}`;
    let userAdvice = "";
    if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
      userAdvice = "ADVICE: This might be due to a stale schema cache in Supabase or the column not existing in the database. Try reloading the schema in your Supabase dashboard (Project Settings > API > Reload schema) or ensure the column is correctly migrated.";
    }
    console.error(`Error toggling task completion (ID: ${taskId}): ${errorDetailsString}. ${userAdvice}`, error);
  }
  return { data: data as Task | null, error };
}

/**
 * Generates a unique share ID for a task and updates the task.
 * This makes the task viewable via a public link (frontend will handle routing).
 * @param taskId The ID of the task to generate a share link for.
 * @returns The updated task data with the new share_id.
 * @throws Error if the task is not found or if there's an update error.
 */
export async function generateShareLink(
  taskId: string
): Promise<{ data: Task | null; error: PostgrestError | null }> {
  if (!taskId) {
    return { data: null, error: { message: 'Task ID is required.', details: '', hint: '', code: '400' } as PostgrestError };
  }

  // Generate a more robust unique ID
  const newShareId = `shr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  const { data, error } = await supabase
    .from('tasks')
    .update({ share_id: newShareId, update_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    const errorDetailsString = `Code: ${error.code || 'N/A'}, Message: ${error.message || 'N/A'}, Details: ${error.details || 'N/A'}, Hint: ${error.hint || 'N/A'}`;
    let userAdvice = "";
    if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
      userAdvice = "ADVICE: This might be due to a stale schema cache in Supabase or the column not existing in the database. Try reloading the schema in your Supabase dashboard (Project Settings > API > Reload schema) or ensure the column is correctly migrated.";
    }
    console.error(`Error generating share link (ID: ${taskId}): ${errorDetailsString}. ${userAdvice}`, error);
  }
  return { data: data as Task | null, error };
}
