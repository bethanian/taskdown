
// src/hooks/useTasks.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import type { Task as TaskType, Attachment, Priority, TaskStatus, RecurrenceRule } from '@/lib/types'; 
import { TASK_STATUS_OPTIONS, DEFAULT_TASK_STATUS, DEFAULT_RECURRENCE_RULE } from '@/lib/types'; 
import { useToast } from '@/hooks/use-toast';
import { processTaskInput as processAiInputFlow, type ProcessTaskInput, type ProcessTaskOutput, type ProcessedTask, type UpdateTaskDetails as AiUpdateTaskDetails } from '@/ai/flows/process-task-input-flow';
import { 
  editTask as editTaskSupabase, 
  type TaskUpdate as SupabaseTaskUpdatePayload,
  type Task as SupabaseTask, // Import the Task type from lib/tasks
  generateShareLink as generateShareLinkSupabase,
} from '@/lib/tasks';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';


// Reflects the Supabase table structure from `taskdown.md`
interface SupabaseTaskRow extends Record<string, any> { // Allows for other columns if any
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
  parent_id: string | null;
  recurrence: RecurrenceRule | null;
  dependent_on: string | null; // Added dependent_on
}

// Converts a Supabase row to our frontend TaskType
const fromSupabase = (row: SupabaseTaskRow): TaskType => {
  return {
    id: row.id,
    text: row.title,
    completed: row.completed,
    tags: row.tags || [],
    priority: row.priority || 'none',
    status: row.status || DEFAULT_TASK_STATUS, // Default if null
    createdAt: new Date(row.created_at).getTime(),
    updateAt: new Date(row.update_at).getTime(),
    dueDate: row.due_date ? new Date(row.due_date).getTime() : undefined,
    subtasks: [], // Initialize as empty, will be populated by hierarchy builder
    notes: row.notes || '',
    attachments: row.attachments || [],
    assignedTo: row.assigned_to || undefined,
    shareId: row.share_id || undefined,
    recurrence: row.recurrence || DEFAULT_RECURRENCE_RULE,
    dependentOnId: row.dependent_on || null, // Map dependent_on
    isBlocked: false, // Default to false, will be calculated
    // dependentOnTaskName is resolved in buildHierarchyAndResolveDependenciesRecursive
  };
};

// Helper function to find a task by ID in a hierarchical structure
const findTaskByIdRecursive = (tasksToSearch: TaskType[], id: string): TaskType | null => {
  for (const task of tasksToSearch) {
    if (task.id === id) {
      return task;
    }
    if (task.subtasks && task.subtasks.length > 0) {
      const foundInSubtask = findTaskByIdRecursive(task.subtasks, id);
      if (foundInSubtask) {
        return foundInSubtask;
      }
    }
  }
  return null;
};


// Builds the task hierarchy and resolves dependency names
const buildHierarchyAndResolveDependenciesRecursive = (
  items: Array<TaskType & { db_parent_id: string | null }>, // items from DB with temporary db_parent_id
  parentId: string | null,
  allTasksFlat: TaskType[] // Pass all flat tasks for dependency lookup
): TaskType[] => {
  return items
    .filter(item => item.db_parent_id === parentId)
    .map(item => {
      let isBlocked = false;
      let dependentOnTaskName: string | undefined = undefined;
      if (item.dependentOnId) {
        // Find the dependency in the flat list of all tasks
        const dependencyTask = allTasksFlat.find(t => t.id === item.dependentOnId);
        if (dependencyTask && !dependencyTask.completed) {
          isBlocked = true;
          dependentOnTaskName = dependencyTask.text;
        }
      }
      return {
        ...item,
        subtasks: buildHierarchyAndResolveDependenciesRecursive(items, item.id, allTasksFlat),
        isBlocked,
        dependentOnTaskName,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt); // Or your preferred sorting
};


// Helper to find a task by text, used by AI processing
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

// Helper to update a task in a hierarchical list (immutable)
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

// Calculate next due date for recurring tasks
function calculateNextDueDate(currentDueDateMs: number, recurrence: RecurrenceRule): Date | null {
  const currentDate = new Date(currentDueDateMs);
  switch (recurrence) {
    case 'daily':
      return addDays(currentDate, 1);
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'monthly':
      return addMonths(currentDate, 1);
    case 'yearly':
      return addYears(currentDate, 1);
    case 'none':
    default:
      return null;
  }
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetches all tasks and rebuilds the hierarchy
  const fetchAndSetTasks = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false }); // Or your preferred default order

    if (error) {
      console.error("Failed to load tasks from Supabase", error);
      toast({
        title: "Error Loading Tasks",
        description: error.message || "Could not load tasks from the database.",
        variant: "destructive",
      });
      setTasks([]);
    } else if (data) {
      // First, map all Supabase rows to flat TaskType objects
      const allTasksFlatMapped = data.map(row => fromSupabase(row as SupabaseTaskRow));
      
      // Then, create a temporary list with db_parent_id for hierarchy building
      const allTasksWithDbParentId = data.map(row => {
        const mappedTask = fromSupabase(row as SupabaseTaskRow); // Use the same mapping
        return { ...mappedTask, db_parent_id: (row as SupabaseTaskRow).parent_id };
      });

      // Build the hierarchy using the temporary list and resolve dependencies using the flat list
      const hierarchicalTasks = buildHierarchyAndResolveDependenciesRecursive(
        allTasksWithDbParentId, 
        null, // Start with top-level tasks (parent_id is null)
        allTasksFlatMapped // Pass the flat list for dependency resolution
      );
      setTasks(hierarchicalTasks);
    } else {
      setTasks([]);
    }
    setIsLoading(false);
  }, [toast]);


  useEffect(() => {
    fetchAndSetTasks();
  }, [fetchAndSetTasks]);

  // Internal function to handle adding tasks, allowing more parameters from AI
  const addTaskInternal = useCallback(async (
    text: string, 
    parentId?: string, 
    recurrence?: RecurrenceRule,
    dueDate?: number, // timestamp for consistency with TaskType
    notes?: string,
    tags?: string[],
    priority?: Priority,
    assignedTo?: string,
    attachments?: Attachment[],
    status?: TaskStatus,
    dependentOnId?: string | null, // Added dependentOnId
    dependentOnTaskText?: string // For AI input to resolve dependency
  ): Promise<string | null> => {
    if (!text.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return null;
    }

    let actualDependentOnId = dependentOnId;
    // If AI provides dependentOnTaskText and dependentOnId is not yet resolved
    if (dependentOnTaskText && !actualDependentOnId) {
        // It's important to use the most current task list for this check
        const existingTasks = tasks; // Use current state to find dependency
        const dependency = findTaskByTextRecursive(existingTasks, dependentOnTaskText);
        if (dependency) {
            actualDependentOnId = dependency.id;
        } else {
            toast({ title: "Warning", description: `Could not find task "${dependentOnTaskText}" to set as dependency.` });
            // Optionally, you could choose to not set the dependency or handle this as an error
        }
    }


    // Prepare payload for Supabase
    const taskPayload: Partial<SupabaseTaskRow> = {
      title: text,
      parent_id: parentId || null,
      recurrence: recurrence || DEFAULT_RECURRENCE_RULE,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes || '',
      tags: tags || [],
      priority: priority || 'none',
      assigned_to: assignedTo || null,
      attachments: attachments || [],
      status: status || DEFAULT_TASK_STATUS,
      completed: false, // New tasks are not completed
      created_at: new Date().toISOString(),
      update_at: new Date().toISOString(),
      dependent_on: actualDependentOnId || null, // Use resolved or provided dependentOnId
    };

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
      await fetchAndSetTasks(); // Re-fetch to update UI with new task and hierarchy
      return (newSupabaseTask as SupabaseTaskRow).id;
    } else {
      // This case should ideally not happen if error is null
      toast({ title: "Error", description: "Task added but no data returned.", variant: "destructive" });
      return null;
    }
  }, [toast, fetchAndSetTasks, tasks]); // tasks dependency for findTaskByTextRecursive
  
  // Public addTask function (simplified for basic UI usage)
  const addTask = useCallback(async (text: string, parentId?: string): Promise<string | null> => {
    // Calls the internal function with fewer parameters for typical UI additions
    return addTaskInternal(text, parentId);
  }, [addTaskInternal]);


  // Handles creation of new recurring task instance
  const handleRecurrence = useCallback(async (completedTask: TaskType) => {
    if (!completedTask.recurrence || completedTask.recurrence === 'none' || !completedTask.dueDate) {
      return; // Not a recurring task or no due date to recur from
    }

    const nextDueDate = calculateNextDueDate(completedTask.dueDate, completedTask.recurrence);
    if (!nextDueDate) {
      return; // Recurrence is 'none' or calculation failed
    }

    // Find the parent_id if the completed task was a subtask
    // This requires searching the current hierarchical `tasks` state
    let parentIdForNewRecurring: string | null = null;
    const findParentRecursive = (taskList: TaskType[], childId: string): string | null => {
        for (const task of taskList) {
            if (task.subtasks?.some(st => st.id === childId)) {
                return task.id;
            }
            if (task.subtasks) {
                const foundParentId = findParentRecursive(task.subtasks, childId);
                if (foundParentId) return foundParentId;
            }
        }
        return null;
    };
    parentIdForNewRecurring = findParentRecursive(tasks, completedTask.id);


    const newRecurringTask: Partial<SupabaseTaskRow> = {
      title: completedTask.text,
      notes: completedTask.notes,
      tags: completedTask.tags,
      priority: completedTask.priority,
      assigned_to: completedTask.assignedTo,
      attachments: completedTask.attachments,
      recurrence: completedTask.recurrence, // Keep the same recurrence rule
      parent_id: parentIdForNewRecurring, // Set parent_id if it was a subtask
      due_date: nextDueDate.toISOString(),
      completed: false, // New instance is not completed
      status: DEFAULT_TASK_STATUS, // Reset status
      created_at: new Date().toISOString(),
      update_at: new Date().toISOString(),
      dependent_on: completedTask.dependentOnId || null, // Preserve dependency if any
    };

    const { error: insertError } = await supabase.from('tasks').insert(newRecurringTask).select().single();

    if (insertError) {
      console.error("Failed to create recurring task instance", insertError);
      toast({ title: "Error", description: `Failed to create next recurring task: ${insertError.message}`, variant: "destructive" });
    } else {
      toast({ title: "Task Recurred", description: `New instance of "${completedTask.text}" created.`});
      // The calling function (toggleComplete or updateTask) will call fetchAndSetTasks
    }
  }, [toast, tasks]); // tasks is needed to find parent_id

  const updateTask = useCallback(async (id: string, updates: SupabaseTaskUpdatePayload) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for updating.", variant: "destructive" });
      return;
    }
    
    // Prevent self-dependency
    const existingTask = findTaskByIdRecursive(tasks, id);
    if (updates.dependent_on === id && id) { // Check if dependent_on is being set to the task's own ID
        toast({ title: "Error", description: "A task cannot depend on itself.", variant: "destructive" });
        return;
    }
    // More complex circular dependency checks (e.g., A -> B -> A) would require graph traversal.

    if (Object.keys(updates).length === 0) {
      // toast({ title: "Info", description: "No changes detected to update." });
      return; // No actual updates to perform
    }

    // Optimistic UI update (optional, but good for UX)
    const originalTasks = [...tasks]; // Shallow copy for potential rollback

    // Helper to apply updates to the TaskType structure for optimistic UI
    const applyOptimisticUpdates = (task: TaskType): TaskType => {
      const taskTypeUpdates: Partial<TaskType> = {};
      if (updates.title !== undefined) taskTypeUpdates.text = updates.title;
      if (updates.completed !== undefined) taskTypeUpdates.completed = updates.completed;
      if (updates.tags !== undefined) taskTypeUpdates.tags = updates.tags || []; // Ensure it's an array
      
      // Handle Priority type assertion carefully
      if (updates.priority !== undefined) {
        const validPriorities: Priority[] = ['high', 'medium', 'low', 'none'];
        if (validPriorities.includes(updates.priority as Priority)) {
          taskTypeUpdates.priority = updates.priority as Priority;
        } else {
          // Default or handle invalid priority from Supabase if needed
          taskTypeUpdates.priority = 'none'; 
        }
      }

      if (updates.status !== undefined) {
        if (TASK_STATUS_OPTIONS.includes(updates.status as TaskStatus)) {
          taskTypeUpdates.status = updates.status as TaskStatus;
        } else {
          taskTypeUpdates.status = DEFAULT_TASK_STATUS;
        }
      }
      if (updates.recurrence !== undefined) taskTypeUpdates.recurrence = updates.recurrence as RecurrenceRule;
      if (updates.notes !== undefined) taskTypeUpdates.notes = updates.notes || '';
      if (updates.attachments !== undefined) taskTypeUpdates.attachments = updates.attachments || [];
      if (updates.assigned_to !== undefined) taskTypeUpdates.assignedTo = updates.assigned_to || undefined;
      if (updates.due_date !== undefined) taskTypeUpdates.dueDate = updates.due_date ? new Date(updates.due_date).getTime() : undefined;
      if (updates.dependent_on !== undefined) taskTypeUpdates.dependentOnId = updates.dependent_on; // Update dependentOnId

      taskTypeUpdates.updateAt = new Date().getTime(); // Update timestamp
      return { ...task, ...taskTypeUpdates };
    };
    
    setTasks(prevTasks => updateTaskInList(prevTasks, id, applyOptimisticUpdates));

    // Prepare payload for Supabase (ensure update_at is current)
    const payloadForSupabase = { ...updates, update_at: new Date().toISOString() };

    try {
      const { data: updatedSupabaseTaskData, error: supabaseError } = await editTaskSupabase(id, payloadForSupabase);
      
      if (supabaseError) {
        // If Supabase says no updates were provided (e.g., due to RLS or no actual change in DB),
        // we still might want to re-fetch if our optimistic update was too aggressive or incorrect.
        if (supabaseError.code === '204' && supabaseError.message === 'No updates provided.') {
          // This might mean the data was already as requested, or RLS prevented the update.
          // Re-fetching ensures UI consistency with the database.
          await fetchAndSetTasks();
          return; 
        }
        throw supabaseError; // Re-throw other errors to be caught below
      }
      
      // If the task was marked completed and is recurring, handle recurrence
      if (updatedSupabaseTaskData && updates.completed === true) {
        // Convert SupabaseTask to TaskType for handleRecurrence
        // Assuming updatedSupabaseTaskData is a single Task object from Supabase
        const taskForRecurrence = fromSupabase(updatedSupabaseTaskData as unknown as SupabaseTaskRow); 
        await handleRecurrence(taskForRecurrence);
      }
      await fetchAndSetTasks(); // Re-fetch to get the latest state including hierarchy and dependencies

    } catch (error: any) {
      // Rollback optimistic UI update on error
      console.error("Failed to update task in Supabase, rolling back UI.", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        originalError: error, // For more detailed debugging if needed
      });
      setTasks(originalTasks); // Revert to the state before optimistic update
      toast({ 
        title: "Update Failed", 
        description: `Task update failed: ${error.message || 'Unknown error'}. Changes have been reverted.`, 
        variant: "destructive" 
      });
    }
  }, [tasks, toast, handleRecurrence, fetchAndSetTasks]);


  const addSubtask = useCallback(async (parentId: string, text: string) => {
    // Calls the internal function, specifying the parentId
    return addTask(text, parentId);
  }, [addTask]);

  const deleteTask = useCallback(async (id: string) => {
    // Before deleting, check if this task is a dependency for other tasks
    const allFlatTasks = tasks.reduce((acc, task) => {
        acc.push(task);
        if (task.subtasks) acc.push(...task.subtasks.flat()); // Simplified flattening for this check
        return acc;
    }, [] as TaskType[]);

    const dependentTasks = allFlatTasks.filter(t => t.dependentOnId === id);
    if (dependentTasks.length > 0) {
      const taskToDelete = findTaskByIdRecursive(tasks, id);
      toast({
        title: "Deletion Blocked",
        description: `Cannot delete task "${taskToDelete?.text || id}". It is a dependency for: ${dependentTasks.map(dt => `"${dt.text}"`).join(', ')}. Please remove dependencies first.`,
        variant: "destructive",
        duration: 7000, // Longer duration for important messages
      });
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Failed to delete task from Supabase", error);
      toast({ title: "Error", description: `Failed to delete task: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task deleted." });
      await fetchAndSetTasks(); // Re-fetch to update UI
    }
  }, [toast, fetchAndSetTasks, tasks]); // tasks needed for dependency check
  
  // Edit task based on AI input
  const editTask = useCallback(async (id: string, updatesFromAi: AiUpdateTaskDetails) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for AI editing.", variant: "destructive" });
      return;
    }
    const supabaseUpdates: SupabaseTaskUpdatePayload = {};
    // Map AI fields to Supabase fields
    if (updatesFromAi.newText !== undefined) supabaseUpdates.title = updatesFromAi.newText;
    if (updatesFromAi.status !== undefined) supabaseUpdates.status = updatesFromAi.status;
    if (updatesFromAi.priority !== undefined) supabaseUpdates.priority = updatesFromAi.priority;
    if (updatesFromAi.assignedTo !== undefined) supabaseUpdates.assigned_to = updatesFromAi.assignedTo === "" ? null : updatesFromAi.assignedTo; // Handle unassignment
    if (updatesFromAi.tags !== undefined) supabaseUpdates.tags = updatesFromAi.tags;
    if (updatesFromAi.notes !== undefined) supabaseUpdates.notes = updatesFromAi.notes;
    if (updatesFromAi.recurrence !== undefined) supabaseUpdates.recurrence = updatesFromAi.recurrence;
    
    // Resolve dependentOnTaskText to dependent_on ID
    if (updatesFromAi.dependentOnTaskText) {
        const dependency = findTaskByTextRecursive(tasks, updatesFromAi.dependentOnTaskText);
        if (dependency) {
            if (dependency.id === id) { // Prevent self-dependency
                toast({ title: "AI Info", description: "AI tried to make a task depend on itself. Ignoring dependency change.", variant: "default" });
            } else {
                supabaseUpdates.dependent_on = dependency.id;
            }
        } else {
            toast({ title: "AI Info", description: `AI specified dependency "${updatesFromAi.dependentOnTaskText}" but task not found. Ignoring dependency change.`, variant: "default" });
        }
    } else if (updatesFromAi.dependentOnTaskText === null || updatesFromAi.dependentOnTaskText === "") { // Explicitly remove dependency
        supabaseUpdates.dependent_on = null;
    }


    if (Object.keys(supabaseUpdates).length === 0) {
      toast({ title: "AI Info", description: "No actionable changes identified by AI for the task update." });
      return;
    }
    
    await updateTask(id, supabaseUpdates);
    toast({ title: "Success", description: "Task updated by AI." }); // Assuming updateTask handles its own success/error toasts for the actual update.

  }, [toast, updateTask, tasks]); // tasks is needed for findTaskByTextRecursive
  
  const toggleComplete = useCallback(async (id: string, currentCompleted: boolean) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return;
    }
    // Check if the task is blocked before allowing completion
    const task = findTaskByIdRecursive(tasks, id);
    if (task?.isBlocked && !currentCompleted) { // If trying to complete a blocked task
        toast({
            title: "Task Blocked",
            description: `Cannot complete task "${task.text}". It is blocked by "${task.dependentOnTaskName}". Complete the dependency first.`,
            variant: "destructive",
            duration: 5000,
        });
        return;
    }

    const newCompletedStatus = !currentCompleted;
    await updateTask(id, { completed: newCompletedStatus }); // updateTask will handle recurrence
    toast({ title: "Success", description: "Task completion toggled." });
  }, [toast, updateTask, tasks]); // tasks is needed for findTaskByIdRecursive

  const updateTaskPriority = useCallback(async (id: string, priority: Priority) => {
    await updateTask(id, { priority });
    toast({ title: "Success", description: "Task priority updated." });
  }, [toast, updateTask]);

  // Generates and returns a shareable link for a task
  const generateShareLink = useCallback(async (id: string): Promise<string | null> => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return null;
    }
    // Call Supabase function to generate/update share_id
    const { data: updatedTaskAfterShare, error } = await generateShareLinkSupabase(id); // Assumes this function exists and returns updated task
    if (error || !updatedTaskAfterShare || !updatedTaskAfterShare.share_id) {
        console.error("Failed to generate share link via Supabase function", error);
        toast({title: "Error", description: `Could not generate share link: ${error?.message || 'No share ID returned.'}`, variant: "destructive"});
        return null;
    }
    toast({title: "Share Link Generated", description: `Task share ID: ${updatedTaskAfterShare.share_id}.`});
    await fetchAndSetTasks(); // Re-fetch to update task in UI with new shareId
    return `${window.location.origin}/share/task/${updatedTaskAfterShare.share_id}`;
  }, [toast, fetchAndSetTasks]);

  const processAiInput = useCallback(async (input: ProcessTaskInput): Promise<ProcessTaskOutput | null> => {
    toast({ title: "AI Processing...", description: "Please wait.", duration: 2000});
    try {
      const aiOutput = await processAiInputFlow(input);
      if (!aiOutput) {
        toast({ title: "AI Error", description: "No output from AI.", variant: "destructive" });
        return null;
      }
      let operationsPerformed = false;
      const newlyCreatedParentsMap = new Map<string, string>(); // To map AI's parent text to actual new parent ID

      // Add tasks first
      if (aiOutput.tasksToAdd && aiOutput.tasksToAdd.length > 0) {
        // Separate main tasks and subtasks from AI output
        const mainTasksFromAI = aiOutput.tasksToAdd.filter(t => !t.parentTaskText);
        const subTasksFromAI = aiOutput.tasksToAdd.filter(t => !!t.parentTaskText);

        // Process main tasks first to get their IDs
        for (const taskToAdd of mainTasksFromAI) {
          const newTaskId = await addTaskInternal(
            taskToAdd.text, 
            undefined, 
            taskToAdd.recurrence, 
            undefined, // dueDate - AI might add this later via update
            undefined, // notes
            undefined, // tags
            undefined, // priority
            undefined, // assignedTo
            undefined, // attachments
            undefined, // status
            undefined, // dependentOnId - AI might set this later
            taskToAdd.dependentOnTaskText // dependentOnTaskText for AI
          );
          if (newTaskId) {
            newlyCreatedParentsMap.set(taskToAdd.text, newTaskId);
            operationsPerformed = true;
            // Recurrence is now handled in addTaskInternal or updateTask
          }
        }
        
        // Get current tasks state AFTER main tasks might have been added
        // This might not be strictly necessary if addTaskInternal re-fetches, but good for clarity
        const currentTasksStateForAISubtasks = tasks; 

        // Process subtasks, resolving parent IDs
        for (const taskToAdd of subTasksFromAI) {
          let parentId: string | null = null;
          if (taskToAdd.parentTaskText) {
            if (newlyCreatedParentsMap.has(taskToAdd.parentTaskText)) {
              parentId = newlyCreatedParentsMap.get(taskToAdd.parentTaskText)!;
            } else {
              // Try to find existing parent task by text
              const parentTask = findTaskByTextRecursive(currentTasksStateForAISubtasks, taskToAdd.parentTaskText);
              if (parentTask) {
                parentId = parentTask.id;
              } else {
                // If parent not found (neither new nor existing), AI might be hallucinating or user made a typo.
                // Defaulting to top-level task for now, or could be an error.
                console.warn(`Parent task "${taskToAdd.parentTaskText}" not found for AI subtask. Adding as top-level.`);
              }
            }
          }
          const newSubtaskId = await addTaskInternal(
            taskToAdd.text, 
            parentId ?? undefined, // Use resolved parentId
            taskToAdd.recurrence,
            undefined, // dueDate
            undefined, // notes
            undefined, // tags
            undefined, // priority
            undefined, // assignedTo
            undefined, // attachments
            undefined, // status
            undefined, // dependentOnId
            taskToAdd.dependentOnTaskText // dependentOnTaskText for AI
            );
           if (newSubtaskId) {
            operationsPerformed = true;
          }
        }
      }

      // Remove tasks
      if (aiOutput.tasksToRemove && aiOutput.tasksToRemove.length > 0) {
        // Get current tasks state before deletion
        const currentTasksStateForAIDeletion = tasks; 
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

      // Update tasks
      if (aiOutput.tasksToUpdate && aiOutput.tasksToUpdate.length > 0) {
        const currentTasksStateForAIUpdate = tasks; // Get current tasks state before updates
        for (const taskToUpdate of aiOutput.tasksToUpdate) {
          const task = findTaskByTextRecursive(currentTasksStateForAIUpdate, taskToUpdate.taskIdentifier); // Find by original identifier
          if (task) {
            await editTask(task.id, taskToUpdate as AiUpdateTaskDetails); // editTask handles mapping to SupabaseTaskUpdate
            operationsPerformed = true;
          } else {
             toast({title: "AI Info", description: `Task "${taskToUpdate.taskIdentifier}" for update not found.`});
          }
        }
      }

      if (operationsPerformed) {
        toast({ title: "AI Actions Completed", description: "Tasks managed by AI.", duration: 3000 });
      } else if (!aiOutput.tasksToAdd?.length && !aiOutput.tasksToRemove?.length && !aiOutput.tasksToUpdate?.length) {
        // Only show "No Action" if AI truly returned empty arrays for all operations.
        toast({ title: "AI No Action", description: "AI did not identify specific tasks to manage.", duration: 3000 });
      }
      await fetchAndSetTasks(); // Final re-fetch to ensure UI is perfectly synced
      return aiOutput;

    } catch (error: any) {
      console.error("Error processing AI input:", error);
      toast({ title: "AI Error", description: error.message || "Failed to process AI command.", variant: "destructive" });
      return null;
    }
  }, [toast, addTaskInternal, deleteTask, editTask, tasks, fetchAndSetTasks]); // Ensure all dependencies are listed

  return { 
    tasks, 
    isLoading, 
    addTask,
    deleteTask,
    editTask, // Expose the AI-centric editTask
    updateTask, // Expose the general updateTask (used by UI components)
    toggleComplete,
    updateTaskPriority,
    addSubtask,
    generateShareLink,
    processAiInput, // Expose the AI input processor
  };
}
    
