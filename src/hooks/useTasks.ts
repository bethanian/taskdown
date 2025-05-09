"use client";

import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import type { Task, Priority } from '@/lib/types';
import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

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
    subtasks: updateSubtasksCompletion(st.subtasks, completed),
  }));
};


export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadTasksRecursive = (tasksToLoad: Task[]): Task[] => {
    return tasksToLoad.map(task => ({
      ...task,
      priority: task.priority || 'none',
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

  const addTask = useCallback((text: string, tags: string[] = []) => {
    if (!text.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return;
    }
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      tags,
      priority: 'none',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtasks: [],
    };
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task added." });
  }, [tasks, saveTasks, toast]);

  const addSubtask = useCallback((parentId: string, text: string, tags: string[] = [], priority: Priority = 'none') => {
    if (!text.trim()) {
      toast({ title: "Info", description: "Subtask text cannot be empty." });
      return;
    }
    const newSubtask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      tags,
      priority,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtasks: [],
    };
    const updatedTasks = addSubtaskRecursive(tasks, parentId, newSubtask);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Subtask added." });
  }, [tasks, saveTasks, toast]);

  const toggleTaskCompletion = useCallback((id: string) => {
    const updateFn = (task: Task): Task => {
      const newCompletedStatus = !task.completed;
      return {
        ...task,
        completed: newCompletedStatus,
        updatedAt: Date.now(),
        subtasks: updateSubtasksCompletion(task.subtasks, newCompletedStatus),
      };
    };
    const updatedTasks = mapTasksRecursively(tasks, id, updateFn);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  }, [tasks, saveTasks]);
  
  const deleteTask = useCallback((id: string) => {
    const updatedTasks = filterTasksRecursively(tasks, id);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task deleted." });
  }, [tasks, saveTasks, toast]);

  const editTask = useCallback((id: string, newText: string, newTags: string[], newPriority: Priority) => {
    if (!newText.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return;
    }
    const updateFn = (task: Task): Task => ({
      ...task,
      text: newText,
      tags: newTags,
      priority: newPriority,
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


  return { 
    tasks, 
    isLoading, 
    addTask, 
    addSubtask,
    toggleTaskCompletion,
    deleteTask,
    editTask,
    updateTaskPriority,
    setTasks, 
    saveTasks, 
  };
}
