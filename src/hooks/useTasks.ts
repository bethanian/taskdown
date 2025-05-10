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


interface SupabaseTaskRow extends Record<string, any> { 
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
  recurrence: RecurrenceRule | null; // Added recurrence
}

const fromSupabase = (row: SupabaseTaskRow): TaskType => {
  return {
    id: row.id,
    text: row.title,
    completed: row.completed,
    tags: row.tags || [],
    priority: row.priority || 'none',
    status: row.status || DEFAULT_TASK_STATUS,
    createdAt: new Date(row.created_at).getTime(),
    updateAt: new Date(row.update_at).getTime(),
    dueDate: row.due_date ? new Date(row.due_date).getTime() : undefined,
    subtasks: [], 
    notes: row.notes || '',
    attachments: row.attachments || [],
    assignedTo: row.assigned_to || undefined,
    shareId: row.share_id || undefined,
    recurrence: row.recurrence || DEFAULT_RECURRENCE_RULE, // Added recurrence
  };
};

const toSupabaseInsert = (
  taskText: string, 
  parentId?: string | null,
  recurrence?: RecurrenceRule,
  dueDate?: string | null
): Partial<SupabaseTaskRow> => {
  const now = new Date().toISOString();
  return {
    title: taskText,
    completed: false,
    tags: [],
    priority: 'none',
    status: DEFAULT_TASK_STATUS,
    created_at: now, 
    update_at: now, 
    due_date: dueDate || null,
    notes: '',
    attachments: [],
    assigned_to: null,
    share_id: null,
    parent_id: parentId || null,
    recurrence: recurrence || DEFAULT_RECURRENCE_RULE, // Added recurrence
  };
};

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
    .sort((a, b) => b.createdAt - a.createdAt); 
};

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
    status?: TaskStatus
  ): Promise<string | null> => {
    if (!text.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return null;
    }
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
      completed: false,
      created_at: new Date().toISOString(),
      update_at: new Date().toISOString(),
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
      await fetchAndSetTasks(); 
      return (newSupabaseTask as SupabaseTaskRow).id;
    } else {
      toast({ title: "Error", description: "Task added but no data returned.", variant: "destructive" });
      return null;
    }
  }, [toast, fetchAndSetTasks]);
  
  const addTask = useCallback(async (text: string, parentId?: string): Promise<string | null> => {
    return addTaskInternal(text, parentId);
  }, [addTaskInternal]);


  const handleRecurrence = useCallback(async (completedTask: TaskType) => {
    if (!completedTask.recurrence || completedTask.recurrence === 'none' || !completedTask.dueDate) {
      return;
    }

    const nextDueDate = calculateNextDueDate(completedTask.dueDate, completedTask.recurrence);
    if (!nextDueDate) {
      return;
    }

    const newRecurringTask = {
      title: completedTask.text,
      notes: completedTask.notes,
      tags: completedTask.tags,
      priority: completedTask.priority,
      assigned_to: completedTask.assignedTo,
      attachments: completedTask.attachments,
      recurrence: completedTask.recurrence,
      parent_id: (tasks.find(t => t.subtasks?.some(st => st.id === completedTask.id))?.id) || null, // Keep parent_id if it was a subtask
      due_date: nextDueDate.toISOString(),
      completed: false,
      status: DEFAULT_TASK_STATUS,
      created_at: new Date().toISOString(),
      update_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('tasks').insert(newRecurringTask).select().single();

    if (insertError) {
      console.error("Failed to create recurring task instance", insertError);
      toast({ title: "Error", description: `Failed to create next recurring task: ${insertError.message}`, variant: "destructive" });
    } else {
      toast({ title: "Task Recurred", description: `New instance of "${completedTask.text}" created.`});
      // Don't call fetchAndSetTasks here as it will be called by the outer function (toggleComplete or updateTask)
    }
  }, [toast, tasks]); // tasks is needed to find parent_id

  const updateTask = useCallback(async (id: string, updates: SupabaseTaskUpdatePayload) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for updating.", variant: "destructive" });
      return;
    }
    if (Object.keys(updates).length === 0) {
      return;
    }

    const originalTasks = [...tasks]; // Shallow copy for optimistic rollback

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
      
      taskTypeUpdates.updateAt = new Date().getTime();

      return { ...task, ...taskTypeUpdates };
    };
    
    setTasks(prevTasks => updateTaskInList(prevTasks, id, applyOptimisticUpdates));

    const payloadForSupabase = { ...updates, update_at: new Date().toISOString() };

    try {
      const { data: updatedSupabaseTaskData, error: supabaseError } = await editTaskSupabase(id, payloadForSupabase);
      if (supabaseError) {
        throw supabaseError; 
      }
      
      if (updatedSupabaseTaskData && updates.completed === true) {
        const taskForRecurrence = fromSupabase(updatedSupabaseTaskData as unknown as SupabaseTaskRow); 
        await handleRecurrence(taskForRecurrence);
      }
      // After all operations (including potential recurrence), refetch to ensure UI consistency.
      await fetchAndSetTasks();

    } catch (error: any) {
      console.error("Failed to update task in Supabase, rolling back UI.", error);
      setTasks(originalTasks); 
      toast({ 
        title: "Update Failed", 
        description: `Task update failed: ${error.message}. Changes have been reverted.`, 
        variant: "destructive" 
      });
    }
  }, [tasks, toast, handleRecurrence, fetchAndSetTasks]);


  const addSubtask = useCallback(async (parentId: string, text: string) => {
    return addTask(text, parentId);
  }, [addTask]);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Failed to delete task from Supabase", error);
      toast({ title: "Error", description: `Failed to delete task: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task deleted." });
      await fetchAndSetTasks();
    }
  }, [toast, fetchAndSetTasks]);
  
  const editTask = useCallback(async (id: string, updatesFromAi: AiUpdateTaskDetails) => {
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
    // Recurrence from AI would need mapping here
    if ((updatesFromAi as any).recurrence !== undefined) supabaseUpdates.recurrence = (updatesFromAi as any).recurrence;


    if (Object.keys(supabaseUpdates).length === 0) {
      toast({ title: "AI Info", description: "No actionable changes identified by AI for the task update." });
      return;
    }
    
    await updateTask(id, supabaseUpdates);
    toast({ title: "Success", description: "Task updated by AI." }); 

  }, [toast, updateTask]);
  
  const toggleComplete = useCallback(async (id: string, currentCompleted: boolean) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return;
    }
    const newCompletedStatus = !currentCompleted;
    // updateTask will handle recurrence and refetching
    await updateTask(id, { completed: newCompletedStatus }); 
    toast({ title: "Success", description: "Task completion toggled." });
  }, [toast, updateTask]);

  const updateTaskPriority = useCallback(async (id: string, priority: Priority) => {
    await updateTask(id, { priority });
    toast({ title: "Success", description: "Task priority updated." });
  }, [toast, updateTask]);

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
    await fetchAndSetTasks(); 
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
      const newlyCreatedParentsMap = new Map<string, string>();

      if (aiOutput.tasksToAdd && aiOutput.tasksToAdd.length > 0) {
        const mainTasksFromAI = aiOutput.tasksToAdd.filter(t => !t.parentTaskText);
        const subTasksFromAI = aiOutput.tasksToAdd.filter(t => !!t.parentTaskText);
        for (const taskToAdd of mainTasksFromAI) {
          const newTaskId = await addTask(taskToAdd.text, undefined);
          if (newTaskId) {
            newlyCreatedParentsMap.set(taskToAdd.text, newTaskId);
            operationsPerformed = true;
            // If AI provides recurrence for new task, it should be handled here
            if ((taskToAdd as any).recurrence) {
                await updateTask(newTaskId, { recurrence: (taskToAdd as any).recurrence });
            }
          }
        }
        
        const currentTasksStateForAISubtasks = tasks; 

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
           if (newSubtaskId) {
            operationsPerformed = true;
            if ((taskToAdd as any).recurrence) {
                 await updateTask(newSubtaskId, { recurrence: (taskToAdd as any).recurrence });
            }
          }
        }
      }

      if (aiOutput.tasksToRemove && aiOutput.tasksToRemove.length > 0) {
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

      if (aiOutput.tasksToUpdate && aiOutput.tasksToUpdate.length > 0) {
        const currentTasksStateForAIUpdate = tasks;
        for (const taskToUpdate of aiOutput.tasksToUpdate) {
          const task = findTaskByTextRecursive(currentTasksStateForAIUpdate, taskToUpdate.taskIdentifier); 
          if (task) {
            // Ensure AiUpdateTaskDetails is correctly cast or mapped to SupabaseTaskUpdatePayload if needed
            await editTask(task.id, taskToUpdate as AiUpdateTaskDetails); 
            operationsPerformed = true;
          } else {
             toast({title: "AI Info", description: `Task "${taskToUpdate.taskIdentifier}" for update not found.`});
          }
        }
      }

      if (operationsPerformed) {
        toast({ title: "AI Actions Completed", description: "Tasks managed by AI.", duration: 3000 });
      } else if (!aiOutput.tasksToAdd?.length && !aiOutput.tasksToRemove?.length && !aiOutput.tasksToUpdate?.length) {
        toast({ title: "AI No Action", description: "AI did not identify specific tasks to manage.", duration: 3000 });
      }
      await fetchAndSetTasks(); // Final refetch after all AI operations.
      return aiOutput;

    } catch (error: any) {
      console.error("Error processing AI input:", error);
      toast({ title: "AI Error", description: error.message || "Failed to process AI command.", variant: "destructive" });
      return null;
    }
  }, [toast, addTask, deleteTask, editTask, tasks, fetchAndSetTasks, processAiInputFlow, updateTask]);

  return { 
    tasks, 
    isLoading, 
    addTask,
    deleteTask,
    editTask, 
    updateTask, 
    toggleComplete,
    updateTaskPriority,
    addSubtask,
    generateShareLink,
    processAiInput,
  };
}
    
```