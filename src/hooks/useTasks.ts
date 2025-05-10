
// src/hooks/useTasks.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import type { Task as TaskType, Attachment, Priority, TaskStatus, RecurrenceRule, TaskFilters, TaskSort, SortableTaskFields } from '@/lib/types'; 
import { TASK_STATUS_OPTIONS, DEFAULT_TASK_STATUS, DEFAULT_RECURRENCE_RULE, DEFAULT_FILTERS, DEFAULT_SORT } from '@/lib/types'; 
import { useToast } from '@/hooks/use-toast';
import { processTaskInput as processAiInputFlow, type ProcessTaskInput, type ProcessTaskOutput, type ProcessedTask, type UpdateTaskDetails as AiUpdateTaskDetails } from '@/ai/flows/process-task-input-flow';
import { 
  editTask as editTaskSupabase, 
  type TaskUpdate as SupabaseTaskUpdatePayload,
  type Task as SupabaseTask, 
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
  recurrence: RecurrenceRule | null;
  dependent_on: string | null; 
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
    recurrence: row.recurrence || DEFAULT_RECURRENCE_RULE,
    dependentOnId: row.dependent_on || null, 
    isBlocked: false, 
  };
};

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

const buildHierarchyAndResolveDependenciesRecursive = (
  items: Array<TaskType & { db_parent_id: string | null }>, 
  parentId: string | null,
  allTasksFlat: TaskType[] 
): TaskType[] => {
  return items
    .filter(item => item.db_parent_id === parentId)
    .map(item => {
      let isBlocked = false;
      let dependentOnTaskName: string | undefined = undefined;
      if (item.dependentOnId) {
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
    // Default sort order before applying user-defined sort from Supabase.
    // The main sorting now happens in the Supabase query.
    // This local sort is more for presentation of subtasks if Supabase doesn't sort them hierarchically.
    .sort((a, b) => a.createdAt - b.createdAt); // Sort subtasks by creation date (ascending)
};

const findTaskByTextRecursive = (tasksToSearch: TaskType[], text: string): TaskType | null => {
  for (const task of tasksToSearch) {
    if (task.text.toLowerCase() === text.toLowerCase()) { // Case-insensitive search
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

// Helper to map frontend sort fields to Supabase column names
const mapSortFieldToDbColumn = (field: SortableTaskFields): string => {
  switch (field) {
    case 'dueDate': return 'due_date';
    case 'createdAt': return 'created_at';
    case 'title': return 'title';
    case 'priority': return 'priority';
    case 'status': return 'status';
    default: return 'created_at'; // Default fallback
  }
};

export function useTasks() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<TaskSort>(DEFAULT_SORT);

  const fetchAndSetTasks = useCallback(async () => {
    setIsLoading(true);
    let query = supabase.from('tasks').select('*');

    // Apply filters
    if (filters.dueDateStart) {
      query = query.gte('due_date', filters.dueDateStart.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
    if (filters.dueDateEnd) {
      // Add 1 day to dueDateEnd to make it inclusive of the selected end date
      const inclusiveEndDate = new Date(filters.dueDateEnd);
      inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
      query = query.lt('due_date', inclusiveEndDate.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
    if (filters.priorities.length > 0) {
      query = query.in('priority', filters.priorities);
    }
    if (filters.assignee && filters.assignee.trim() !== '') {
      query = query.ilike('assigned_to', `%${filters.assignee.trim()}%`);
    }
    if (filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }

    // Apply sorting
    const dbSortField = mapSortFieldToDbColumn(sort.field);
    query = query.order(dbSortField, { 
        ascending: sort.direction === 'asc',
        // For text fields like title, priority, status, nullsLast is often preferred
        // For date fields, nullsFirst might be preferred if ascending means "sooner"
        nullsFirst: sort.direction === 'asc' ? true : false 
    });
    // Add secondary sort for stability if primary sort values are the same
    if (dbSortField !== 'created_at') {
        query = query.order('created_at', { ascending: false });
    }


    const { data, error } = await query;

    if (error) {
      console.error("Failed to load tasks from Supabase", error);
      toast({
        title: "Error Loading Tasks",
        description: error.message || "Could not load tasks from the database.",
        variant: "destructive",
      });
      setTasks([]);
    } else if (data) {
      const allTasksFlatMapped = data.map(row => fromSupabase(row as SupabaseTaskRow));
      const allTasksWithDbParentId = data.map(row => {
        const mappedTask = fromSupabase(row as SupabaseTaskRow);
        return { ...mappedTask, db_parent_id: (row as SupabaseTaskRow).parent_id };
      });
      const hierarchicalTasks = buildHierarchyAndResolveDependenciesRecursive(
        allTasksWithDbParentId, 
        null, 
        allTasksFlatMapped 
      );
      setTasks(hierarchicalTasks);
    } else {
      setTasks([]);
    }
    setIsLoading(false);
  }, [toast, filters, sort]);


  useEffect(() => {
    fetchAndSetTasks();
  }, [fetchAndSetTasks]);

  const addTaskInternal = useCallback(async (
    text: string, 
    parentId?: string, 
    recurrenceRule?: RecurrenceRule,
    taskDueDate?: number, 
    taskNotes?: string,
    taskTags?: string[],
    taskPriority?: Priority,
    taskAssignedTo?: string,
    taskAttachments?: Attachment[],
    taskStatus?: TaskStatus,
    taskDependentOnId?: string | null, 
    taskDependentOnTaskText?: string 
  ): Promise<string | null> => {
    if (!text.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return null;
    }

    let actualDependentOnId = taskDependentOnId;
    if (taskDependentOnTaskText && !actualDependentOnId) {
        const dependency = findTaskByTextRecursive(tasks, taskDependentOnTaskText);
        if (dependency) {
            actualDependentOnId = dependency.id;
        } else {
            toast({ title: "Warning", description: `Could not find task "${taskDependentOnTaskText}" to set as dependency.` });
        }
    }

    const taskPayload: Partial<SupabaseTaskRow> = {
      title: text,
      parent_id: parentId || null,
      recurrence: recurrenceRule || DEFAULT_RECURRENCE_RULE,
      due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
      notes: taskNotes || '',
      tags: taskTags || [],
      priority: taskPriority || 'none',
      assigned_to: taskAssignedTo || null,
      attachments: taskAttachments || [],
      status: taskStatus || DEFAULT_TASK_STATUS,
      completed: false, 
      created_at: new Date().toISOString(),
      update_at: new Date().toISOString(),
      dependent_on: actualDependentOnId || null, 
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
  }, [toast, fetchAndSetTasks, tasks]); 
  
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
      recurrence: completedTask.recurrence, 
      parent_id: parentIdForNewRecurring, 
      due_date: nextDueDate.toISOString(),
      completed: false, 
      status: DEFAULT_TASK_STATUS, 
      created_at: new Date().toISOString(),
      update_at: new Date().toISOString(),
      dependent_on: completedTask.dependentOnId || null, 
    };

    const { error: insertError } = await supabase.from('tasks').insert(newRecurringTask).select().single();

    if (insertError) {
      console.error("Failed to create recurring task instance", insertError);
      toast({ title: "Error", description: `Failed to create next recurring task: ${insertError.message}`, variant: "destructive" });
    } else {
      toast({ title: "Task Recurred", description: `New instance of "${completedTask.text}" created.`});
    }
  }, [toast, tasks]); 

  const updateTask = useCallback(async (id: string, updates: SupabaseTaskUpdatePayload) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required for updating.", variant: "destructive" });
      return;
    }
    
    const existingTask = findTaskByIdRecursive(tasks, id);
    if (updates.dependent_on === id && id) { 
        toast({ title: "Error", description: "A task cannot depend on itself.", variant: "destructive" });
        return;
    }

    if (Object.keys(updates).length === 0) {
      return; 
    }

    const originalTasks = JSON.parse(JSON.stringify(tasks)); // Deep copy for potential rollback

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
      if (updates.dependent_on !== undefined) taskTypeUpdates.dependentOnId = updates.dependent_on; 

      taskTypeUpdates.updateAt = new Date().getTime(); 
      return { ...task, ...taskTypeUpdates };
    };
    
    setTasks(prevTasks => updateTaskInList(prevTasks, id, applyOptimisticUpdates));

    const payloadForSupabase = { ...updates, update_at: new Date().toISOString() };

    try {
      const { data: updatedSupabaseTaskData, error: supabaseError } = await editTaskSupabase(id, payloadForSupabase);
      
      if (supabaseError) {
        if (supabaseError.code === 'PGRST116' && supabaseError.message.includes("The result contains 0 rows")) {
            // This means the task might have been deleted or RLS prevented access.
            console.warn(`Task with ID ${id} not found during update or RLS prevented update. Fetching latest tasks.`);
            await fetchAndSetTasks();
            return;
        }
        if (supabaseError.code === '204' && supabaseError.message === 'No updates provided.') {
          await fetchAndSetTasks();
          return; 
        }
        throw supabaseError; 
      }
      
      if (updatedSupabaseTaskData && updates.completed === true) {
        const taskForRecurrence = fromSupabase(updatedSupabaseTaskData as unknown as SupabaseTaskRow); 
        await handleRecurrence(taskForRecurrence);
      }
      await fetchAndSetTasks(); 

    } catch (error: any) {
      console.error("Failed to update task in Supabase, rolling back UI.", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        originalError: error, 
      });
      setTasks(originalTasks); 
      toast({ 
        title: "Update Failed", 
        description: `Task update failed: ${error.message || 'Unknown error'}. Changes have been reverted.`, 
        variant: "destructive" 
      });
    }
  }, [tasks, toast, handleRecurrence, fetchAndSetTasks]);

  const addSubtask = useCallback(async (parentId: string, text: string) => {
    return addTask(text, parentId);
  }, [addTask]);

  const deleteTask = useCallback(async (id: string) => {
    const allFlatTasks = tasks.reduce((acc, task) => {
        acc.push(task);
        if (task.subtasks) {
          const flattenSubtasks = (subtasks: TaskType[]): TaskType[] => {
            let flat: TaskType[] = [];
            for (const st of subtasks) {
              flat.push(st);
              if (st.subtasks) {
                flat = flat.concat(flattenSubtasks(st.subtasks));
              }
            }
            return flat;
          };
          acc.push(...flattenSubtasks(task.subtasks));
        }
        return acc;
    }, [] as TaskType[]);

    const dependentTasks = allFlatTasks.filter(t => t.dependentOnId === id);
    if (dependentTasks.length > 0) {
      const taskToDelete = findTaskByIdRecursive(tasks, id);
      toast({
        title: "Deletion Blocked",
        description: `Cannot delete task "${taskToDelete?.text || id}". It is a dependency for: ${dependentTasks.map(dt => `"${dt.text}"`).join(', ')}. Please remove dependencies first.`,
        variant: "destructive",
        duration: 7000, 
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
      await fetchAndSetTasks(); 
    }
  }, [toast, fetchAndSetTasks, tasks]); 
  
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
    if (updatesFromAi.recurrence !== undefined) supabaseUpdates.recurrence = updatesFromAi.recurrence;
    
    if (updatesFromAi.dependentOnTaskText) {
        const dependency = findTaskByTextRecursive(tasks, updatesFromAi.dependentOnTaskText);
        if (dependency) {
            if (dependency.id === id) { 
                toast({ title: "AI Info", description: "AI tried to make a task depend on itself. Ignoring dependency change.", variant: "default" });
            } else {
                supabaseUpdates.dependent_on = dependency.id;
            }
        } else {
            toast({ title: "AI Info", description: `AI specified dependency "${updatesFromAi.dependentOnTaskText}" but task not found. Ignoring dependency change.`, variant: "default" });
        }
    } else if (updatesFromAi.dependentOnTaskText === null || updatesFromAi.dependentOnTaskText === "") { 
        supabaseUpdates.dependent_on = null;
    }

    if (Object.keys(supabaseUpdates).length === 0) {
      toast({ title: "AI Info", description: "No actionable changes identified by AI for the task update." });
      return;
    }
    
    await updateTask(id, supabaseUpdates);

  }, [toast, updateTask, tasks]); 
  
  const toggleComplete = useCallback(async (id: string, currentCompleted: boolean) => {
    if (!id) {
      toast({ title: "Error", description: "Task ID is required.", variant: "destructive"});
      return;
    }
    const task = findTaskByIdRecursive(tasks, id);
    if (task?.isBlocked && !currentCompleted) { 
        toast({
            title: "Task Blocked",
            description: `Cannot complete task "${task.text}". It is blocked by "${task.dependentOnTaskName}". Complete the dependency first.`,
            variant: "destructive",
            duration: 5000,
        });
        return;
    }

    const newCompletedStatus = !currentCompleted;
    await updateTask(id, { completed: newCompletedStatus }); 
  }, [toast, updateTask, tasks]); 

  const updateTaskPriority = useCallback(async (id: string, taskPriority: Priority) => {
    await updateTask(id, { priority: taskPriority });
  }, [updateTask]);

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
          const newTaskId = await addTaskInternal(
            taskToAdd.text, 
            undefined, 
            taskToAdd.recurrence, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            taskToAdd.dependentOnTaskText 
          );
          if (newTaskId) {
            newlyCreatedParentsMap.set(taskToAdd.text, newTaskId);
            operationsPerformed = true;
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
          const newSubtaskId = await addTaskInternal(
            taskToAdd.text, 
            parentId ?? undefined, 
            taskToAdd.recurrence,
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            taskToAdd.dependentOnTaskText 
            );
           if (newSubtaskId) {
            operationsPerformed = true;
          }
        }
      }

      if (aiOutput.tasksToRemove && aiOutput.tasksToRemove.length > 0) {
        const currentTasksStateForAIDeletion = tasks; 
        for (const taskToRemove of aiOutput.tasksToRemove) {
          const taskFound = findTaskByTextRecursive(currentTasksStateForAIDeletion, taskToRemove.text);
          if (taskFound) {
            await deleteTask(taskFound.id);
            operationsPerformed = true;
          } else {
            toast({title: "AI Info", description: `Task "${taskToRemove.text}" for deletion not found.`});
          }
        }
      }

      if (aiOutput.tasksToUpdate && aiOutput.tasksToUpdate.length > 0) {
        const currentTasksStateForAIUpdate = tasks; 
        for (const taskToUpdate of aiOutput.tasksToUpdate) {
          const taskFound = findTaskByTextRecursive(currentTasksStateForAIUpdate, taskToUpdate.taskIdentifier); 
          if (taskFound) {
            await editTask(taskFound.id, taskToUpdate as AiUpdateTaskDetails); 
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
      await fetchAndSetTasks(); 
      return aiOutput;

    } catch (error: any) {
      console.error("Error processing AI input:", error);
      toast({ title: "AI Error", description: error.message || "Failed to process AI command.", variant: "destructive" });
      return null;
    }
  }, [toast, addTaskInternal, deleteTask, editTask, tasks, fetchAndSetTasks]); 

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
    filters, // Expose current filters
    setFilters, // Expose setter for filters
    sort, // Expose current sort
    setSort, // Expose setter for sort
  };
}
    
