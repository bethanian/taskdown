// src/hooks/useTasks.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import type { Task, Priority, Attachment, TaskStatus } from '@/lib/types';
import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_TASK_STATUS } from '@/lib/types';
import type { ProcessTaskOutput, ProcessedTask } from '@/ai/flows/process-task-input-flow';


localforage.config({
  name: 'TaskdownDB',
  storeName: 'tasks',
  description: 'Stores tasks for Taskdown app',
});

// Helper function to recursively map through tasks and their subtasks
const mapTasksRecursively = (
  tasksToMap: Task[],
  taskId: string,
  updateFn: (task: Task) => Task
): Task[] => {
  return tasksToMap.map(task => {
    if (task.id === taskId) {
      return updateFn(task);
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return {
        ...task,
        subtasks: mapTasksRecursively(task.subtasks, taskId, updateFn),
      };
    }
    return task;
  });
};

// Helper function to recursively filter (delete) tasks
const filterTasksRecursively = (
  tasksToFilter: Task[],
  taskIdToDelete: string
): Task[] => {
  return tasksToFilter
    .filter(task => task.id !== taskIdToDelete)
    .map(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        return {
          ...task,
          subtasks: filterTasksRecursively(task.subtasks, taskIdToDelete),
        };
      }
      return task;
    });
};

// Helper to add subtask
const addSubtaskRecursive = (
  tasksToAddSubtaskTo: Task[],
  parentId: string,
  subtask: Task
): Task[] => {
  return tasksToAddSubtaskTo.map(task => {
    if (task.id === parentId) {
      return {
        ...task,
        subtasks: [...(task.subtasks || []), subtask],
        updatedAt: Date.now(),
      };
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return {
        ...task,
        subtasks: addSubtaskRecursive(task.subtasks, parentId, subtask),
      };
    }
    return task;
  });
};

// Helper to complete/uncomplete all subtasks
const updateSubtasksCompletion = (subtasks: Task[] | undefined, completed: boolean): Task[] => {
  if (!subtasks) return [];
  return subtasks.map(st => ({
    ...st,
    completed,
    updatedAt: Date.now(),
    status: completed ? 'Done' : st.status === 'Done' ? DEFAULT_TASK_STATUS : st.status, // Also update status if completed/uncompleted
    subtasks: updateSubtasksCompletion(st.subtasks, completed),
  }));
};

// Helper to find a task by text (and its ID) recursively for deletion or parent lookup
const findTaskByTextRecursive = (
  tasksToSearch: Task[],
  searchText: string
): Task | null => {
  for (const task of tasksToSearch) {
    // Case-insensitive and trim comparison
    if (task.text.trim().toLowerCase() === searchText.trim().toLowerCase()) {
      return task;
    }
    if (task.subtasks && task.subtasks.length > 0) {
      const foundInSubtasks = findTaskByTextRecursive(task.subtasks, searchText);
      if (foundInSubtasks) {
        return foundInSubtasks;
      }
    }
  }
  return null;
};


export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadTasksRecursive = (tasksToLoad: Task[]): Task[] => {
    return tasksToLoad.map(task => ({
      ...task,
      tags: task.tags || [],
      priority: task.priority || 'none',
      status: task.status || DEFAULT_TASK_STATUS, 
      notes: task.notes || '',
      attachments: task.attachments || [],
      assignedTo: task.assignedTo || undefined,
      shareId: task.shareId || undefined,
      dueDate: task.dueDate || undefined, // Load dueDate
      subtasks: task.subtasks ? loadTasksRecursive(task.subtasks) : [],
    }));
  };

  useEffect(() => {
    async function loadTasks() {
      try {
        const storedTasks = await localforage.getItem<Task[]>(LOCALSTORAGE_TASKS_KEY);
        if (storedTasks) {
          setTasks(loadTasksRecursive(storedTasks));
        }
      } catch (error) {
        console.error("Failed to load tasks from localForage", error);
        toast({
          title: "Error",
          description: "Could not load tasks from local storage.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadTasks();
  }, [toast]);

  const saveTasks = useCallback(async (updatedTasks: Task[]) => {
    try {
      await localforage.setItem(LOCALSTORAGE_TASKS_KEY, updatedTasks);
    } catch (error) {
      console.error("Failed to save tasks to localForage", error);
      toast({
        title: "Error",
        description: "Could not save tasks to local storage.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Core logic, no side effects (toast, setTasks, saveTasks)
  const coreAddTask = (text: string, currentTasks: Task[]): { updatedTasks: Task[], newTaskId: string | null } => {
    if (!text.trim()) {
      return { updatedTasks: currentTasks, newTaskId: null };
    }
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      tags: [],
      priority: 'none',
      status: DEFAULT_TASK_STATUS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtasks: [],
      notes: '',
      attachments: [],
      assignedTo: undefined,
      shareId: undefined,
      dueDate: undefined, // Initialize dueDate
    };
    const updatedTasks = [newTask, ...currentTasks];
    return { updatedTasks, newTaskId: newTask.id };
  };

  const coreAddSubtask = (parentId: string, text: string, currentTasks: Task[], tags: string[] = [], priority: Priority = 'none'): Task[] => {
    if (!text.trim()) {
      return currentTasks;
    }
    const newSubtask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      tags,
      priority,
      status: DEFAULT_TASK_STATUS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtasks: [],
      notes: '',
      attachments: [],
      assignedTo: undefined,
      shareId: undefined,
      dueDate: undefined, // Initialize dueDate for subtasks
    };
    return addSubtaskRecursive(currentTasks, parentId, newSubtask);
  };
  
  const coreDeleteTask = (id: string, currentTasks: Task[]): Task[] => {
    return filterTasksRecursively(currentTasks, id);
  };

  // Wrappers with side effects for single operations
  const addTask = useCallback((text: string) => {
    const { updatedTasks, newTaskId } = coreAddTask(text, tasks);
    if (newTaskId) {
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
      toast({ title: "Success", description: "Task added." });
    } else if (text.trim()) { 
      toast({ title: "Info", description: "Task text cannot be empty." });
    }
  }, [tasks, saveTasks, toast]);

  const addSubtask = useCallback((parentId: string, text: string, tags: string[] = [], priority: Priority = 'none') => {
    const updatedTasks = coreAddSubtask(parentId, text, tasks, tags, priority);
    if (updatedTasks !== tasks) { 
        setTasks(updatedTasks);
        saveTasks(updatedTasks);
        toast({ title: "Success", description: "Subtask added." });
    } else if (text.trim()){
        toast({ title: "Info", description: "Subtask text cannot be empty." });
    }
  }, [tasks, saveTasks, toast]);

  const deleteTask = useCallback((id: string) => {
    const updatedTasks = coreDeleteTask(id, tasks);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task deleted." });
  }, [tasks, saveTasks, toast]);


  const toggleTaskCompletion = useCallback((id: string) => {
    const updateFn = (task: Task): Task => {
      const newCompletedStatus = !task.completed;
      return {
        ...task,
        completed: newCompletedStatus,
        status: newCompletedStatus ? 'Done' : (task.status === 'Done' ? DEFAULT_TASK_STATUS : task.status),
        updatedAt: Date.now(),
        subtasks: updateSubtasksCompletion(task.subtasks, newCompletedStatus),
      };
    };
    const updatedTasks = mapTasksRecursively(tasks, id, updateFn);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  }, [tasks, saveTasks]);
  
  const editTask = useCallback((
    id: string, 
    newText: string, 
    newTags: string[], 
    newPriority: Priority,
    newNotes: string,
    newAttachments: Attachment[],
    newStatus: TaskStatus,
    newAssignedTo: string | undefined,
    newDueDate: number | undefined // Added newDueDate
  ) => {
    if (!newText.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return;
    }
    const updateFn = (task: Task): Task => ({
      ...task,
      text: newText,
      tags: newTags,
      priority: newPriority,
      notes: newNotes,
      attachments: newAttachments,
      status: newStatus,
      assignedTo: newAssignedTo,
      dueDate: newDueDate, // Update dueDate
      completed: newStatus === 'Done' ? true : (newStatus !== 'Done' && task.completed ? false : task.completed),
      updatedAt: Date.now(),
    });
    const updatedTasks = mapTasksRecursively(tasks, id, updateFn);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task updated." });
  }, [tasks, saveTasks, toast]);

  const updateTaskPriority = useCallback((id: string, priority: Priority) => {
    const updateFn = (task: Task): Task => ({ ...task, priority, updatedAt: Date.now() });
    const updatedTasks = mapTasksRecursively(tasks, id, updateFn);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
    toast({ title: "Success", description: `Task priority set to ${priorityLabel}.` });
  }, [tasks, saveTasks, toast]);

  const updateTaskStatus = useCallback((id: string, newStatus: TaskStatus) => {
    const updateFn = (task: Task): Task => ({ 
      ...task, 
      status: newStatus,
      completed: newStatus === 'Done', 
      updatedAt: Date.now() 
    });
    const updatedTasks = mapTasksRecursively(tasks, id, updateFn);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: `Task status set to ${newStatus}.`});
  }, [tasks, saveTasks, toast]);

  const assignTask = useCallback((id: string, assignee: string | undefined) => {
    const updateFn = (task: Task): Task => ({ ...task, assignedTo: assignee, updatedAt: Date.now() });
    const updatedTasks = mapTasksRecursively(tasks, id, updateFn);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    if (assignee) {
      toast({ title: "Success", description: `Task assigned to ${assignee}.` });
    } else {
      toast({ title: "Success", description: "Task unassigned." });
    }
  }, [tasks, saveTasks, toast]);

  const generateShareLink = useCallback(async (taskId: string): Promise<string | null> => {
    let taskToShare: Task | null = null;
    let newShareId = '';

    const findAndUpdateTask = (currentTasks: Task[]): Task[] => {
      return currentTasks.map(t => {
        if (t.id === taskId) {
          newShareId = t.shareId || crypto.randomUUID();
          taskToShare = { ...t, shareId: newShareId };
          return taskToShare;
        }
        if (t.subtasks && t.subtasks.length > 0) {
          return { ...t, subtasks: findAndUpdateTask(t.subtasks) };
        }
        return t;
      });
    };
    
    const updatedTasks = findAndUpdateTask(tasks);

    if (taskToShare) {
      setTasks(updatedTasks);
      await saveTasks(updatedTasks);
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/share/task/${newShareId}`; 
      
      try {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link Copied!", description: "Shareable link copied to clipboard." });
      } catch (err) {
        toast({ title: "Error", description: "Could not copy link to clipboard.", variant: "destructive"});
        console.error('Failed to copy: ', err);
      }
      return link;
    }
    toast({ title: "Error", description: "Task not found for sharing.", variant: "destructive"});
    return null;
  }, [tasks, saveTasks, toast]);

  const applyAiTaskOperations = useCallback(async (operations: ProcessTaskOutput) => {
    let currentTasksState = [...tasks]; // Operate on a copy
    let changesMade = 0;
    const parentTextToIdMap = new Map<string, string>();

    // Process additions
    // First pass: add top-level tasks and map their text to ID
    for (const taskToAdd of operations.tasksToAdd.filter(t => !t.parentTaskText)) {
      if (!taskToAdd.text.trim()) continue;
      const { updatedTasks, newTaskId } = coreAddTask(taskToAdd.text, currentTasksState);
      if (newTaskId) {
        currentTasksState = updatedTasks;
        parentTextToIdMap.set(taskToAdd.text, newTaskId); // Map original text from AI
        changesMade++;
      }
    }

    // Second pass: add subtasks
    for (const taskToAdd of operations.tasksToAdd.filter(t => t.parentTaskText)) {
      if (!taskToAdd.text.trim() || !taskToAdd.parentTaskText) continue;
      
      let parentId = parentTextToIdMap.get(taskToAdd.parentTaskText);
      
      if (!parentId) {
        // If parent wasn't in *this batch* of top-level tasks, search existing tasks
        const existingParentTask = findTaskByTextRecursive(currentTasksState, taskToAdd.parentTaskText);
        if (existingParentTask) {
          parentId = existingParentTask.id;
        }
      }

      if (parentId) {
        const prevLength = currentTasksState.flatMap(t => t.subtasks || []).length;
        currentTasksState = coreAddSubtask(parentId, taskToAdd.text, currentTasksState);
        const newLength = currentTasksState.flatMap(t => t.subtasks || []).length;
        if (newLength > prevLength || currentTasksState.find(t=> t.id === parentId)?.subtasks?.find(st => st.text === taskToAdd.text) ) {
            changesMade++;
        }
      } else {
        console.warn(`Parent task "${taskToAdd.parentTaskText}" not found for subtask "${taskToAdd.text}". Adding as top-level.`);
        const { updatedTasks: newTopLevelTasks, newTaskId: newTopLevelId } = coreAddTask(taskToAdd.text, currentTasksState);
        if (newTopLevelId) {
          currentTasksState = newTopLevelTasks;
          parentTextToIdMap.set(taskToAdd.text, newTopLevelId);
          changesMade++;
        }
      }
    }

    // Process removals
    for (const taskToRemove of operations.tasksToRemove) {
      if (!taskToRemove.text.trim()) continue;
      const taskToDelete = findTaskByTextRecursive(currentTasksState, taskToRemove.text);
      if (taskToDelete) {
        currentTasksState = coreDeleteTask(taskToDelete.id, currentTasksState);
        changesMade++;
      } else {
        console.warn(`Task "${taskToRemove.text}" not found for removal.`);
      }
    }

    if (changesMade > 0) {
      setTasks(currentTasksState);
      await saveTasks(currentTasksState);
      toast({ title: "AI Tasks Processed", description: `${changesMade} update(s) made based on AI instructions.` });
    } else {
      toast({ title: "AI Tasks Processed", description: "No changes made by AI or tasks not found." });
    }
  }, [tasks, saveTasks, toast]);


  return { 
    tasks, 
    isLoading, 
    addTask,
    addSubtask,
    toggleTaskCompletion,
    deleteTask,
    editTask,
    updateTaskPriority,
    updateTaskStatus,
    assignTask,
    generateShareLink,
    setTasks, 
    saveTasks, 
    applyAiTaskOperations,
  };
}
