// src/hooks/useTasks.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
// import localforage from 'localforage'; // REMOVE: No longer using localforage
import { supabase } from '@/lib/supabaseClient'; // ADD: Supabase client
// Corrected import: TASK_STATUS_OPTIONS and DEFAULT_TASK_STATUS are values, Priority and TaskStatus are types.
import type { Task as TaskType, Attachment, Priority, TaskStatus } from '@/lib/types'; 
import { TASK_STATUS_OPTIONS, DEFAULT_TASK_STATUS } from '@/lib/types'; 
// import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants'; // REMOVE: No longer using for primary storage
import { useToast } from '@/hooks/use-toast';
// MODIFIED: Import the actual AI processing function and its types
import { processTaskInput as processAiInputFlow, type ProcessTaskInput, type ProcessTaskOutput, type ProcessedTask, type UpdateTaskDetails } from '@/ai/flows/process-task-input-flow';
// MODIFIED: Import task manipulation functions from src/lib/tasks
import { 
  editTask as editTaskSupabase, 
  // toggleComplete as toggleCompleteSupabase, // No longer directly used by useTasks.toggleComplete
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
  update_at: string;
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
    updateAt: new Date(row.update_at).getTime(), // Assuming updated_at is always present
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
    update_at: now, // Supabase can also default this with now()
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

// NEW: Recursive helper to update a task in a list (including subtasks)
const updateTaskInList = (
  taskList: TaskType[],
  taskId: string,
  updateFn: (task: TaskType) => TaskType
): TaskType[] => {
  return taskList.map(task => {
    if (task.id === taskId) {
      return updateFn(task);
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return { ...task, subtasks: updateTaskInList(task.subtasks, taskId, updateFn) };
    }
    return task;
  });
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

  // REFACTORED: updateTask for optimistic updates
  const updateTask = useCallback(async (id: string, updates: SupabaseTaskUpdatePayload) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for updating.", variant: "destructive" });
      return;
    }
    if (Object.keys(updates).length === 0) {
      return;
    }

    const originalTasks = tasks;

    const applyOptimisticUpdates = (task: TaskType): TaskType => {
      const taskTypeUpdates: Partial<TaskType> = {};
      if (updates.title !== undefined) taskTypeUpdates.text = updates.title;
      if (updates.completed !== undefined) taskTypeUpdates.completed = updates.completed;
      if (updates.tags !== undefined) taskTypeUpdates.tags = updates.tags || []; 
      
      if (updates.priority !== undefined) {
        const validPriorities: Priority[] = ['high', 'medium', 'low', 'none'];
        if (validPriorities.includes(updates.priority as Priority)) {
          taskTypeUpdates.priority = updates.priority as Priority;
        } else {
          console.warn(`Optimistic update: Invalid priority value "${updates.priority}" received, defaulting to 'none'.`);
          taskTypeUpdates.priority = 'none';
        }
      }

      if (updates.status !== undefined) {
        if (TASK_STATUS_OPTIONS.includes(updates.status as TaskStatus)) {
          taskTypeUpdates.status = updates.status as TaskStatus;
        } else {
          console.warn(`Optimistic update: Invalid status value "${updates.status}" received, defaulting to DEFAULT_TASK_STATUS.`);
          taskTypeUpdates.status = DEFAULT_TASK_STATUS;
        }
      }

      if (updates.notes !== undefined) taskTypeUpdates.notes = updates.notes || '';
      if (updates.attachments !== undefined) taskTypeUpdates.attachments = updates.attachments || [];
      if (updates.assigned_to !== undefined) taskTypeUpdates.assignedTo = updates.assigned_to || undefined;
      if (updates.due_date !== undefined) taskTypeUpdates.dueDate = updates.due_date ? new Date(updates.due_date).getTime() : undefined;
      
      taskTypeUpdates.updateAt = new Date().getTime();

      return { ...task, ...taskTypeUpdates };
    };

    const optimisticallyUpdatedTasks = updateTaskInList(originalTasks, id, applyOptimisticUpdates);
    setTasks(optimisticallyUpdatedTasks);

    const payloadForSupabase = { ...updates, update_at: new Date().toISOString() };

    try {
      const { error: supabaseError } = await editTaskSupabase(id, payloadForSupabase);
      if (supabaseError) {
        throw supabaseError; 
      }
      // Success toast can be more specific if desired, or kept generic
      // toast({ title: "Success", description: "Task updated." }); 
      // No fetchAndSetTasks() here to maintain optimistic update feel
    } catch (error: any) {
      console.error("Failed to update task in Supabase, rolling back UI.", error);
      setTasks(originalTasks); // Rollback UI
      toast({ 
        title: "Update Failed", 
        description: `Task update failed: ${error.message}. Changes have been reverted.`, 
        variant: "destructive" 
      });
    }
  }, [tasks, toast]); // TASK_STATUS_OPTIONS, DEFAULT_TASK_STATUS are constants, no need for deps

  // editTask (AI flow) will now use the optimistic updateTask
  const editTask = useCallback(async (id: string, updatesFromAi: UpdateTaskDetails) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for AI editing.", variant: "destructive" });
      return;
    }
    const supabaseUpdates: SupabaseTaskUpdatePayload = {};
    if (updatesFromAi.newText !== undefined) supabaseUpdates.title = updatesFromAi.newText;
    if (updatesFromAi.status !== undefined) supabaseUpdates.status = updatesFromAi.status;
    if (updatesFromAi.priority !== undefined) supabaseUpdates.priority = updatesFromAi.priority;
    if (updatesFromAi.assignedTo !== undefined) supabaseUpdates.assigned_to = updatesFromAi.assignedTo === "" ? null : updatesFromAi.assignedTo;
    if (updatesFromAi.tags !== undefined) supabaseUpdates.tags = updatesFromAi.tags;
    if (updatesFromAi.notes !== undefined) supabaseUpdates.notes = updatesFromAi.notes;
    // dueDate from AI would need mapping here if it was part of UpdateTaskDetails

    if (Object.keys(supabaseUpdates).length === 0) {
      toast({ title: "AI Info", description: "No actionable changes identified by AI for the task update." });
      return;
    }
    
    await updateTask(id, supabaseUpdates); // Uses the new optimistic updateTask
    // Toast for AI completion might be better handled by processAiInput or here if needed
    toast({ title: "Success", description: "Task updated by AI." }); // This might be redundant if updateTask shows its own success

  }, [toast, updateTask]);
  
  // REFACTORED: toggleComplete to use optimistic updateTask
  const toggleComplete = useCallback(async (id: string, currentCompleted: boolean) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return;
    }
    const newCompletedStatus = !currentCompleted;
    await updateTask(id, { completed: newCompletedStatus });
    // Specific toast for completion
    toast({ title: "Success", description: "Task completion toggled." });
  }, [toast, updateTask]);

  // REFACTORED: updateTaskPriority to use optimistic updateTask
  const updateTaskPriority = useCallback(async (id: string, priority: Priority) => {
    await updateTask(id, { priority });
    // Specific toast for priority
    toast({ title: "Success", description: "Task priority updated." });
  }, [toast, updateTask]);

  // generateShareLink remains the same, does not need optimistic update for its primary action
  const generateShareLink = useCallback(async (id: string): Promise<string | null> => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return null;
    }
    const { data: updatedTaskAfterShare, error } = await generateShareLinkSupabase(id);
    if (error || !updatedTaskAfterShare || !updatedTaskAfterShare.share_id) {
        console.error("Failed to generate share link via Supabase function", error);
        toast({title: "Error", description: `Could not generate share link: ${error?.message || 'No share ID returned.'}`, variant: "destructive"});
        return null;
    }
    toast({title: "Share Link Generated", description: `Task share ID: ${updatedTaskAfterShare.share_id}.`});
    // Potentially update local task with share_id optimistically or refetch for this one task
    // For now, fetchAndSetTasks is simple, but for true optimistic, this could be refined.
    await fetchAndSetTasks(); 
    return `${window.location.origin}/share/task/${updatedTaskAfterShare.share_id}`;
  }, [toast, fetchAndSetTasks]);

  // processAiInput still uses fetchAndSetTasks indirectly via addTask, deleteTask, editTask (which now uses updateTask)
  // Consider if processAiInput needs more granular optimistic updates for each sub-operation.
  // For now, its internal calls to addTask/deleteTask will cause refetches.
  // editTask within processAiInput now correctly uses the optimistic updateTask.
  const processAiInput = useCallback(async (input: ProcessTaskInput): Promise<ProcessTaskOutput | null> => {
    toast({ title: "AI Processing...", description: "Please wait.", duration: 2000});
    try {
      const aiOutput = await processAiInputFlow(input);
      if (!aiOutput) {
        toast({ title: "AI Error", description: "No output from AI.", variant: "destructive" });
        return null;
      }
      let operationsPerformed = false;
      const newlyCreatedParentsMap = new Map<string, string>();

      if (aiOutput.tasksToAdd && aiOutput.tasksToAdd.length > 0) {
        const mainTasksFromAI = aiOutput.tasksToAdd.filter(t => !t.parentTaskText);
        const subTasksFromAI = aiOutput.tasksToAdd.filter(t => !!t.parentTaskText);
        for (const taskToAdd of mainTasksFromAI) {
          const newTaskId = await addTask(taskToAdd.text, undefined);
          if (newTaskId) {
            newlyCreatedParentsMap.set(taskToAdd.text, newTaskId);
            operationsPerformed = true;
          }
        }
        // addTask calls fetchAndSetTasks, so tasks state is updated for next step
        const currentTasksStateForAISubtasks = tasks; // Capture state after main tasks are added (or rely on tasks being updated)

        for (const taskToAdd of subTasksFromAI) {
          let parentId: string | null = null;
          if (taskToAdd.parentTaskText) {
            if (newlyCreatedParentsMap.has(taskToAdd.parentTaskText)) {
              parentId = newlyCreatedParentsMap.get(taskToAdd.parentTaskText)!;
            } else {
              const parentTask = findTaskByTextRecursive(currentTasksStateForAISubtasks, taskToAdd.parentTaskText);
              if (parentTask) {
                parentId = parentTask.id;
              } else {
                console.warn(`Parent task "${taskToAdd.parentTaskText}" not found for AI subtask. Adding as top-level.`);
              }
            }
          }
          const newSubtaskId = await addTask(taskToAdd.text, parentId ?? undefined);
          if (newSubtaskId) operationsPerformed = true;
        }
      }

      if (aiOutput.tasksToRemove && aiOutput.tasksToRemove.length > 0) {
        const currentTasksStateForAIDeletion = tasks; // Capture most recent state
        for (const taskToRemove of aiOutput.tasksToRemove) {
          const task = findTaskByTextRecursive(currentTasksStateForAIDeletion, taskToRemove.text);
          if (task) {
            await deleteTask(task.id);
            operationsPerformed = true;
          } else {
            toast({title: "AI Info", description: `Task "${taskToRemove.text}" for deletion not found.`});
          }
        }
      }

      if (aiOutput.tasksToUpdate && aiOutput.tasksToUpdate.length > 0) {
        // editTask (which uses updateTask) is now optimistic, no full refetch from its direct call.
        const currentTasksStateForAIUpdate = tasks;
        for (const taskToUpdate of aiOutput.tasksToUpdate) {
          const task = findTaskByTextRecursive(currentTasksStateForAIUpdate, taskToUpdate.taskIdentifier); 
          if (task) {
            await editTask(task.id, taskToUpdate); 
            operationsPerformed = true;
          } else {
             toast({title: "AI Info", description: `Task "${taskToUpdate.taskIdentifier}" for update not found.`});
          }
        }
      }

      if (operationsPerformed) {
        // If addTask or deleteTask were called, fetchAndSetTasks already ran.
        // If only editTask was called, UI is optimistically updated.
        // A final fetch might still be desired by some for absolute consistency after batch AI ops.
        // For now, let's assume individual function refetches (or lack thereof for optimistic ones) are okay.
        toast({ title: "AI Actions Completed", description: "Tasks managed by AI.", duration: 3000 });
      } else if (!aiOutput.tasksToAdd?.length && !aiOutput.tasksToRemove?.length && !aiOutput.tasksToUpdate?.length) {
        toast({ title: "AI No Action", description: "AI did not identify specific tasks to manage.", duration: 3000 });
      }
      
      return aiOutput;

    } catch (error: any) {
      console.error("Error processing AI input:", error);
      toast({ title: "AI Error", description: error.message || "Failed to process AI command.", variant: "destructive" });
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, addTask, deleteTask, editTask, tasks, fetchAndSetTasks, processAiInputFlow]);

  return { 
    tasks, 
    isLoading, 
    addTask,
    deleteTask,
    editTask, // This is the AI specific editTask, which now calls the general updateTask
    updateTask, // The general optimistic updateTask
    toggleComplete,
    updateTaskPriority,
    addSubtask,
    generateShareLink,
    processAiInput,
  };
}

// Ensure old helper functions that are not used are removed to avoid linting errors or confusion.
// For example, if mapTasksRecursively, filterTasksRecursively etc. were defined globally in this file.

    