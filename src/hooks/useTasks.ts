"use client";

import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import type { Task } from '@/lib/types';
import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

localforage.config({
  name: 'TaskdownDB',
  storeName: 'tasks',
  description: 'Stores tasks for Taskdown app',
});

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadTasks() {
      try {
        const storedTasks = await localforage.getItem<Task[]>(LOCALSTORAGE_TASKS_KEY);
        if (storedTasks) {
          setTasks(storedTasks);
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task added." });
  }, [tasks, saveTasks, toast]);

  const toggleTaskCompletion = useCallback((id: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed, updatedAt: Date.now() } : task
    );
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  }, [tasks, saveTasks]);
  
  const deleteTask = useCallback((id: string) => {
    const updatedTasks = tasks.filter(task => task.id !== id);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task deleted." });
  }, [tasks, saveTasks, toast]);

  const editTask = useCallback((id: string, newText: string, newTags: string[]) => {
    if (!newText.trim()) {
      toast({ title: "Info", description: "Task text cannot be empty." });
      return;
    }
    const updatedTasks = tasks.map(task =>
      task.id === id ? { ...task, text: newText, tags: newTags, updatedAt: Date.now() } : task
    );
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    toast({ title: "Success", description: "Task updated." });
  }, [tasks, saveTasks, toast]);


  return { 
    tasks, 
    isLoading, 
    addTask, 
    toggleTaskCompletion,
    deleteTask,
    editTask,
    setTasks, // Useful for drag-and-drop or batch updates if needed later
    saveTasks, // Expose for more complex scenarios
  };
}
