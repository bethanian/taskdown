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
  if (Object.keys(updates).length === 0) {
    // This case should ideally be caught by the calling function (e.g., in useTasks)
    // to prevent an unnecessary API call. If it still reaches here,
    // it means no actual update would occur in the DB.
    return { data: null, error: { message: 'No updates provided.', details: 'Update object was empty.', hint: 'No database operation was performed.', code: '204' } as PostgrestError };
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, update_at: new Date().toISOString() }) // Ensure update_at is always updated
    .eq('id', taskId)
    .select()
    .single(); // .single() assumes the ID is unique and will return one row or an error

  if (error) {
    console.error(`Error editing task (ID: ${taskId}):`, error); // Log the raw error object
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
    console.error('Error toggling task completion:', error);
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

  const newShareId = `shr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  const { data, error } = await supabase
    .from('tasks')
    .update({ share_id: newShareId, update_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error generating share link:', error);
  }
  return { data: data as Task | null, error };
}
