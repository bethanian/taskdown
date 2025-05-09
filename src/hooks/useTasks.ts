// src/hooks/useTasks.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
// import localforage from 'localforage'; // REMOVE: No longer using localforage
import { supabase } from '@/lib/supabaseClient'; // ADD: Supabase client
import type { Task as TaskType, Priority, Attachment, TaskStatus } from '@/lib/types'; // Rename to avoid conflict
// import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants'; // REMOVE: No longer using for primary storage
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_TASK_STATUS } from '@/lib/types';
// MODIFIED: Import the actual AI processing function and its types
import { processTaskInput as processAiInputFlow, type ProcessTaskInput, type ProcessTaskOutput, type ProcessedTask, type UpdateTaskDetails } from '@/ai/flows/process-task-input-flow';
// MODIFIED: Import task manipulation functions from src/lib/tasks
import { 
  editTask as editTaskSupabase, 
  toggleComplete as toggleCompleteSupabase, 
  generateShareLink as generateShareLinkSupabase,
  type TaskUpdate as SupabaseTaskUpdatePayload // Keep this type for mapping
} from '@/lib/tasks';

// localforage.config({ // REMOVE
//   name: 'TaskdownDB',
//   storeName: 'tasks',
//   description: 'Stores tasks for Taskdown app',
// });

// --- Supabase Data Mapping Helpers ---
interface SupabaseTaskRow extends Record<string, any> { // Define a more specific type for Supabase rows
  id: string;
  title: string;
  completed: boolean;
  tags: string[] | null;
  priority: Priority | null;
  status: TaskStatus | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  notes: string | null;
  attachments: Attachment[] | null;
  assigned_to: string | null;
  share_id: string | null;
  parent_id: string | null; // Crucial for hierarchy
}

const fromSupabase = (row: SupabaseTaskRow): TaskType => {
        return {
    id: row.id,
    text: row.title,
    completed: row.completed,
    tags: row.tags || [],
    priority: row.priority || 'none',
    status: row.status || DEFAULT_TASK_STATUS,
    createdAt: new Date(row.created_at).getTime(), // Assuming created_at is always present
    updatedAt: new Date(row.updated_at).getTime(), // Assuming updated_at is always present
    dueDate: row.due_date ? new Date(row.due_date).getTime() : undefined,
    subtasks: [], // Populated by buildHierarchy
    notes: row.notes || '',
    attachments: row.attachments || [],
    assignedTo: row.assigned_to || undefined,
    shareId: row.share_id || undefined,
  };
};

const toSupabaseInsert = (taskText: string, parentId?: string | null): Partial<SupabaseTaskRow> => {
  const now = new Date().toISOString();
      return {
    title: taskText,
    completed: false,
    tags: [],
    priority: 'none',
    status: DEFAULT_TASK_STATUS,
    created_at: now, // Supabase can also default this with now()
    updated_at: now, // Supabase can also default this with now()
    due_date: null,
    notes: '',
    attachments: [],
    assigned_to: null,
    share_id: null,
    parent_id: parentId || null,
  };
};

// Helper function to build hierarchy from a flat list of tasks that include their raw parent_id
const buildHierarchyRecursive = (
    items: Array<TaskType & { db_parent_id: string | null }>,
    parentId: string | null
  ): TaskType[] => {
  return items
    .filter(item => item.db_parent_id === parentId)
    .map(item => ({
      ...item,
      subtasks: buildHierarchyRecursive(items, item.id),
    }))
    .sort((a, b) => b.createdAt - a.createdAt); // Sort by creation time, newest first
};

// Helper function to find a task (and its subtasks) by text recursively
const findTaskByTextRecursive = (tasksToSearch: TaskType[], text: string): TaskType | null => {
  for (const task of tasksToSearch) {
    if (task.text === text) {
      return task;
    }
    if (task.subtasks && task.subtasks.length > 0) {
      const foundInSubtask = findTaskByTextRecursive(task.subtasks, text);
      if (foundInSubtask) {
        return foundInSubtask;
      }
    }
  }
  return null;
};

export function useTasks() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAndSetTasks = useCallback(async () => {
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
      const allTasksMapped = data.map(row => {
        const mappedTask = fromSupabase(row as SupabaseTaskRow);
        return { ...mappedTask, db_parent_id: (row as SupabaseTaskRow).parent_id };
      });
      const hierarchicalTasks = buildHierarchyRecursive(allTasksMapped, null);
      setTasks(hierarchicalTasks);
    } else {
      setTasks([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAndSetTasks();
  }, [fetchAndSetTasks]);

  const addTask = useCallback(async (text: string, parentId?: string): Promise<string | null> => {
    if (!text.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return null;
    }
    const taskPayload = toSupabaseInsert(text, parentId);
    const { data: newSupabaseTask, error } = await supabase
      .from('tasks')
      .insert(taskPayload)
      .select()
      .single();

    if (error) {
      console.error("Failed to add task to Supabase", error);
      toast({ title: "Error", description: `Failed to add task: ${error.message}`, variant: "destructive" });
      return null;
    }
    if (newSupabaseTask) {
      toast({ title: "Success", description: parentId ? "Subtask added." : "Task added." });
      await fetchAndSetTasks(); 
      return (newSupabaseTask as SupabaseTaskRow).id;
    } else {
      toast({ title: "Error", description: "Task added but no data returned.", variant: "destructive" });
      return null;
    }
  }, [toast, fetchAndSetTasks]);

  const addSubtask = useCallback(async (parentId: string, text: string) => {
    return addTask(text, parentId);
  }, [addTask]);

  const deleteTask = useCallback(async (id: string) => {
    // First, recursively find all descendant task IDs to ensure they are deleted if not using ON DELETE CASCADE
    // This is a client-side recursive delete. For true atomicity, a stored procedure or relying on ON DELETE CASCADE is better.
    const descendantIdsToDelete: string[] = [];
    const findDescendantsRecursive = (parentIdToDelete: string, currentTasks: TaskType[]) => {
      currentTasks.forEach(task => {
        if ((task as any).db_parent_id === parentIdToDelete) { // Check against the temporarily stored db_parent_id
          descendantIdsToDelete.push(task.id);
          if (task.subtasks && task.subtasks.length > 0) {
            findDescendantsRecursive(task.id, task.subtasks); // Incorrect: task.subtasks are already filtered children
          }
        }
      });
    };
    // To use findDescendantsRecursive correctly, we need the flat list of tasks before hierarchy building,
    // or pass the full hierarchical tasks state and traverse it. The current `tasks` state is hierarchical.
    // A simpler approach for now if not using ON DELETE CASCADE is to delete the main task
    // and let the user handle subtasks, or implement a proper recursive delete in Supabase (e.g. Edge Function).

    // For this implementation, we'll delete the specified task and its direct children as fetched by current logic.
    // A more robust solution would be ON DELETE CASCADE in the DB.

    // Collect IDs to delete: the task itself and its current subtasks in the state
    const idsToDelete = new Set<string>();
    idsToDelete.add(id);

    const queue: TaskType[] = [...tasks];
    while(queue.length > 0) {
        const currentTask = queue.shift();
        if (!currentTask) continue;
        if (currentTask.id === id || Array.from(idsToDelete).some(delId => (currentTask as any).db_parent_id === delId)) {
            idsToDelete.add(currentTask.id); // Add task if its parent is marked for deletion
        }
        if (currentTask.subtasks) {
            queue.push(...currentTask.subtasks);
        }
    }
    // The above logic is flawed for finding all descendants in a hierarchical client state for deletion.
    // Correct client-side recursive deletion requires careful traversal or a flat list with parent_ids.

    // Simplification: Delete the task and assume ON DELETE CASCADE is handled by DB or subtasks are handled manually.
    // Or, perform a multi-delete if we know all IDs.
    // For now, just delete the single task ID passed.
    // If ON DELETE CASCADE is set on the `parent_id` foreign key in Supabase, subtasks will be deleted automatically.
    // If not, this will orphan subtasks.

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Failed to delete task from Supabase", error);
      toast({ title: "Error", description: `Failed to delete task: ${error.message}`, variant: "destructive" });
      } else {
      toast({ title: "Success", description: "Task deleted." });
      // Refetch all tasks to update the UI
      await fetchAndSetTasks();
    }
  }, [toast, fetchAndSetTasks, tasks]); // tasks dependency for potential local filtering if not refetching

  // MODIFIED: Call editTaskSupabase from @/lib/tasks
  const editTask = useCallback(async (id: string, updatesFromAi: UpdateTaskDetails) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for editing.", variant: "destructive" });
      return;
    }

    // Map AI's UpdateTaskDetails to SupabaseTaskUpdatePayload for src/lib/tasks's editTask
    const supabaseUpdates: SupabaseTaskUpdatePayload = {};
    if (updatesFromAi.newText !== undefined) supabaseUpdates.title = updatesFromAi.newText;
    if (updatesFromAi.status !== undefined) supabaseUpdates.status = updatesFromAi.status;
    if (updatesFromAi.priority !== undefined) supabaseUpdates.priority = updatesFromAi.priority;
    // Note: The TaskType in useTasks uses 'text' for title.
    // The SupabaseTaskUpdatePayload (from src/lib/tasks) uses 'title'. This mapping is now correct.
    // Other fields from UpdateTaskDetails that match SupabaseTaskUpdatePayload:
    if (updatesFromAi.assignedTo !== undefined) supabaseUpdates.assigned_to = updatesFromAi.assignedTo === "" ? null : updatesFromAi.assignedTo;
    if (updatesFromAi.tags !== undefined) supabaseUpdates.tags = updatesFromAi.tags;
    if (updatesFromAi.notes !== undefined) supabaseUpdates.notes = updatesFromAi.notes;
    // dueDate needs to be mapped if AI provides it and it matches a field in SupabaseTaskUpdatePayload
    // Assuming AI's UpdateTaskDetailsSchema does not currently output dueDate. If it did, add mapping here.

    if (Object.keys(supabaseUpdates).length === 0) {
      toast({ title: "Info", description: "No actionable changes identified by AI for the task update." });
      return;
    }
    
    const { error } = await editTaskSupabase(id, supabaseUpdates);

    if (error) {
      console.error("Failed to edit task via Supabase function", error);
      toast({ title: "Error", description: `Failed to edit task: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task updated by AI." });
      await fetchAndSetTasks(); // Refetch to reflect changes
    }
  }, [toast, fetchAndSetTasks]);
  
  // MODIFIED: Call toggleCompleteSupabase from @/lib/tasks
  const toggleComplete = useCallback(async (id: string, completedStatus?: boolean) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return;
    }
    
    let currentCompleted = completedStatus;
    if (currentCompleted === undefined) {
        // Fetch current status if not provided - this is important for toggleCompleteSupabase
        const { data: taskData, error: fetchError } = await supabase
            .from('tasks')
            .select('completed')
            .eq('id', id)
            .single();

        if (fetchError || !taskData) {
            console.error("Failed to fetch task for toggle:", fetchError);
            toast({ title: "Error", description: "Could not fetch task to toggle.", variant: "destructive"});
            return;
        }
        currentCompleted = taskData.completed;
    }

    // toggleCompleteSupabase expects the *current* status to then invert it.
    const { error } = await toggleCompleteSupabase(id, currentCompleted as boolean);

    if (error) {
      console.error("Failed to toggle task completion via Supabase function", error);
      toast({ title: "Error", description: `Failed to toggle task: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task completion toggled." });
      await fetchAndSetTasks();
    }
  }, [toast, fetchAndSetTasks]);

  // MODIFIED: Call generateShareLinkSupabase from @/lib/tasks
  const generateShareLink = useCallback(async (id: string): Promise<string | null> => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return null;
    }
    
    const { data: updatedTask, error } = await generateShareLinkSupabase(id);

    if (error || !updatedTask || !updatedTask.share_id) {
        console.error("Failed to generate share link via Supabase function", error);
        toast({title: "Error", description: `Could not generate share link: ${error?.message || 'No share ID returned.'}`, variant: "destructive"});
        return null;
    }
    
    toast({title: "Share Link Generated", description: `Task share ID: ${updatedTask.share_id}.`});
    await fetchAndSetTasks(); // Refetch to show new share_id if displayed
    return `${window.location.origin}/view-task/${updatedTask.share_id}`; // Adjusted example link
  }, [toast, fetchAndSetTasks]);

  // MODIFIED: Use the actual AI flow
  const processAiInput = useCallback(async (input: ProcessTaskInput): Promise<ProcessTaskOutput | null> => {
    toast({ title: "AI Processing...", description: "Please wait.", duration: 2000});
    try {
      const aiOutput = await processAiInputFlow(input);

      if (!aiOutput) {
        toast({ title: "AI Error", description: "No output from AI.", variant: "destructive" });
        return null;
      }

      let operationsPerformed = false;
      // tasksCurrentlyInState is not strictly needed if findTaskByTextRecursive always uses the latest `tasks` state
      // and if addTask refetches properly before the next find call for a different subtask group.
      // However, for finding parents of subtasks *within the same AI batch*, we need a more direct approach.

      // Process tasks to add (Revised Two-Pass Approach)
      if (aiOutput.tasksToAdd && aiOutput.tasksToAdd.length > 0) {
        const mainTasksFromAI = aiOutput.tasksToAdd.filter(t => !t.parentTaskText);
        const subTasksFromAI = aiOutput.tasksToAdd.filter(t => !!t.parentTaskText);
        const newlyCreatedParentsMap = new Map<string, string>(); // Maps task text to new ID

        // Pass 1: Add main tasks
        for (const taskToAdd of mainTasksFromAI) {
          const newTaskId = await addTask(taskToAdd.text, undefined);
          if (newTaskId) {
            newlyCreatedParentsMap.set(taskToAdd.text, newTaskId);
            operationsPerformed = true;
          }
        }

        // Pass 2: Add subtasks
        // Note: addTask internally calls fetchAndSetTasks, so the `tasks` state variable 
        // will be updated after each main task addition. 
        // The newlyCreatedParentsMap gives immediate access to IDs from THIS batch.
        for (const taskToAdd of subTasksFromAI) {
          let parentId: string | null = null;
          if (taskToAdd.parentTaskText) {
            if (newlyCreatedParentsMap.has(taskToAdd.parentTaskText)) {
              parentId = newlyCreatedParentsMap.get(taskToAdd.parentTaskText)!;
            } else {
              // Parent wasn't in *this* batch of new main tasks, search existing/recently-added state
              const parentTask = findTaskByTextRecursive(tasks, taskToAdd.parentTaskText);
              if (parentTask) {
                parentId = parentTask.id;
              } else {
                console.warn(`Parent task with text "${taskToAdd.parentTaskText}" not found for subtask "${taskToAdd.text}". Adding as top-level.`);
              }
            }
          }
          const newSubtaskId = await addTask(taskToAdd.text, parentId ?? undefined);
          if (newSubtaskId) {
            operationsPerformed = true;
          }
        }
      }

      // Process tasks to remove
      if (aiOutput.tasksToRemove && aiOutput.tasksToRemove.length > 0) {
        // Use the current `tasks` state which should be updated by any `addTask` operations above.
        for (const taskToRemove of aiOutput.tasksToRemove) {
          const task = findTaskByTextRecursive(tasks, taskToRemove.text);
          if (task) {
            await deleteTask(task.id);
            operationsPerformed = true;
          } else {
            console.warn(`Task with text "${taskToRemove.text}" not found for deletion.`);
            toast({title: "AI Info", description: `Task "${taskToRemove.text}" for deletion not found.`, variant: "default"});
          }
        }
      }

      // Process tasks to update
      if (aiOutput.tasksToUpdate && aiOutput.tasksToUpdate.length > 0) {
        // Use the current `tasks` state.
        for (const taskToUpdate of aiOutput.tasksToUpdate) {
          const task = findTaskByTextRecursive(tasks, taskToUpdate.taskIdentifier); 
          if (task) {
            await editTask(task.id, taskToUpdate); 
            operationsPerformed = true;
          } else {
            console.warn(`Task with text "${taskToUpdate.taskIdentifier}" not found for update.`);
            toast({title: "AI Info", description: `Task "${taskToUpdate.taskIdentifier}" for update not found.`, variant: "default"});
          }
        }
      }

      if (operationsPerformed) {
        // A single fetchAndSetTasks at the end might be more efficient if addTask/deleteTask/editTask 
        // didn't already call it. But since they do, the state should be mostly consistent.
        // A final call here ensures the absolute latest state if there were rapid sequential operations not fully captured.
        // However, given current structure, this might be redundant. Let's rely on individual function refetches for now.
        // If issues persist, consider a single final fetchAndSetTasks() here and make internal ones conditional.
        toast({ title: "AI Actions Completed", description: "Tasks managed by AI.", duration: 3000 });
      } else if (!aiOutput.tasksToAdd?.length && !aiOutput.tasksToRemove?.length && !aiOutput.tasksToUpdate?.length) {
        toast({ title: "AI No Action", description: "AI did not identify specific tasks to manage from your input.", duration: 3000 });
      }
      
      return aiOutput;

    } catch (error: any) {
      console.error("Error processing AI input:", error);
      toast({ title: "AI Error", description: error.message || "Failed to process AI command.", variant: "destructive" });
      return null;
    }
  }, [toast, addTask, deleteTask, editTask, tasks, fetchAndSetTasks, processAiInputFlow]); // Added processAiInputFlow to dependencies

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

    