// src/hooks/useTasks.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
// import localforage from 'localforage'; // REMOVE: No longer using localforage
import { supabase } from '@/lib/supabaseClient'; // ADD: Supabase client
import type { Task as TaskType, Priority, Attachment, TaskStatus } from '@/lib/types'; // Rename to avoid conflict
// import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants'; // REMOVE: No longer using for primary storage
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_TASK_STATUS } from '@/lib/types';
import type { ProcessTaskOutput, ProcessedTask, UpdateTaskDetails } from '@/ai/flows/process-task-input-flow';

// localforage.config({ // REMOVE
//   name: 'TaskdownDB',
//   storeName: 'tasks',
//   description: 'Stores tasks for Taskdown app',
// });

// --- Supabase Data Mapping Helpers ---
const fromSupabase = (row: any): TaskType => {
  if (!row) return {} as TaskType; 
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    tags: row.tags || [],
    priority: row.priority || 'none',
    status: row.status || DEFAULT_TASK_STATUS,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    dueDate: row.due_date ? new Date(row.due_date).getTime() : undefined,
    subtasks: [], // Will be populated separately by hierarchy builder
    notes: row.notes || '',
    attachments: row.attachments || [],
    assignedTo: row.assigned_to || undefined,
    shareId: row.share_id || undefined,
  };
};

const toSupabase = (task: Partial<TaskType>, isNew: boolean = false): any => {
  const supabaseObj: any = {};
  if (task.text !== undefined) supabaseObj.text = task.text;
  if (task.completed !== undefined) supabaseObj.completed = task.completed;
  if (task.tags !== undefined) supabaseObj.tags = task.tags;
  if (task.priority !== undefined) supabaseObj.priority = task.priority;
  if (task.status !== undefined) supabaseObj.status = task.status;
  
  if (task.updatedAt !== undefined && !isNew) supabaseObj.updated_at = new Date(task.updatedAt).toISOString();
  if (isNew && task.createdAt !== undefined) supabaseObj.created_at = new Date(task.createdAt).toISOString();
  else if (isNew && task.createdAt === undefined) supabaseObj.created_at = new Date().toISOString(); 

  if (task.dueDate !== undefined) supabaseObj.due_date = task.dueDate ? new Date(task.dueDate).toISOString() : null;
  else if (isNew) supabaseObj.due_date = null; // Ensure due_date is null if not provided for new tasks

  if (task.notes !== undefined) supabaseObj.notes = task.notes;
  else if (isNew) supabaseObj.notes = '';
  
  if (task.attachments !== undefined) supabaseObj.attachments = task.attachments;
  else if (isNew) supabaseObj.attachments = [];

  if (task.assignedTo !== undefined) supabaseObj.assigned_to = task.assignedTo;
  else if (isNew) supabaseObj.assigned_to = null;

  if (task.shareId !== undefined) supabaseObj.share_id = task.shareId;
  else if (isNew) supabaseObj.share_id = null;

  // parent_id will be handled separately when adding/moving tasks
  // id is handled by Supabase for new tasks
  return supabaseObj;
};

// REMOVE: Old recursive helpers - will be replaced or adapted
// const mapTasksRecursively = ... (and others)

export function useTasks() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load tasks from Supabase (initial flat load)
  useEffect(() => {
    async function loadInitialTasks() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Failed to load tasks from Supabase", error);
        toast({
          title: "Error Loading Tasks",
          description: error.message || "Could not load tasks from the database.",
          variant: "destructive",
        });
        setTasks([]);
      } else if (data) {
        // For now, just load them flat. Hierarchy will be next.
        setTasks(data.map(fromSupabase)); 
      } else {
        setTasks([]);
      }
      setIsLoading(false);
    }
    loadInitialTasks();
  }, [toast]);

  // REMOVE: Old loadTasksRecursive and localforage useEffect
  // const loadTasksRecursive = ...
  // useEffect(() => { localforage load logic }, [toast]);

  // REMOVE: saveTasks (will interact with Supabase directly in each function)
  // const saveTasks = useCallback(async (updatedTasks: TaskType[]) => {...}, [toast]);

  // --- CRUD Operations and other functions will be refactored below ---
  // For now, keep them as they are or stub them out to avoid errors
  // so the application can load with the new fetching logic.

  const addTask = useCallback(async (text: string, parentId?: string) => {
    console.warn("addTask with Supabase not implemented yet");
    toast({title: "Pending Feature", description: "Adding tasks with Supabase backend is being updated."}) 
    return null; // Placeholder
  }, [toast]);

  const addSubtask = useCallback(async (parentId: string, text: string) => {
    console.warn("addSubtask with Supabase not implemented yet");
    return addTask(text, parentId); // Placeholder
  }, [addTask, toast]);

  const deleteTask = useCallback(async (id: string) => {
    console.warn("deleteTask with Supabase not implemented yet");
    toast({title: "Pending Feature", description: "Deleting tasks with Supabase backend is being updated."}) 
  }, [toast]);

  const editTask = useCallback(async (id: string, updates: Partial<Omit<TaskType, 'subtasks' | 'id'>>) => {
    console.warn("editTask with Supabase not implemented yet");
    toast({title: "Pending Feature", description: "Editing tasks with Supabase backend is being updated."}) 
  }, [toast]);
  
  const toggleComplete = useCallback(async (id: string, completedStatus?: boolean) => {
    console.warn("toggleComplete with Supabase not implemented yet");
    toast({title: "Pending Feature", description: "Toggling task completion with Supabase backend is being updated."}) 
  }, [toast]);

  const generateShareLink = useCallback(async (id: string): Promise<string | null> => {
    console.warn("generateShareLink with Supabase not implemented yet");
    toast({title: "Pending Feature", description: "Generating share links with Supabase backend is being updated."}) 
    return null; // Placeholder
  }, [toast]);

  const processAiInput = useCallback(async (input: ProcessTaskOutput): Promise<void> => {
    console.warn("processAiInput with Supabase not implemented yet");
    toast({title: "Pending Feature", description: "AI processing with Supabase backend is being updated."}) 
  }, [toast]);

  // Keep the return structure for now
  return {
    tasks,
    isLoading,
    addTask,
    deleteTask,
    editTask,
    toggleComplete,
    addSubtask,
    generateShareLink,
    processAiInput,
  };
}

// Ensure old helper functions that are not used are removed to avoid linting errors or confusion.
// For example, if mapTasksRecursively, filterTasksRecursively etc. were defined globally in this file.

    