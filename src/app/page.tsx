"use client";

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/taskdown/Header';
import { NewTaskForm } from '@/components/taskdown/NewTaskForm';
import { ChecklistView } from '@/components/taskdown/ChecklistView';
import { useTasks } from '@/hooks/useTasks';
import { TagFilter } from '@/components/taskdown/TagFilter';
import type { Task } from '@/lib/types';
import { GlobalSearchBar } from '@/components/taskdown/GlobalSearchBar'; // Added

export default function TaskdownPage() {
  const { 
    tasks, 
    isLoading, 
    addTask, 
    addSubtask,
    toggleTaskCompletion, 
    deleteTask, 
    editTask, 
    updateTaskPriority, 
    setTasks, 
    saveTasks 
  } = useTasks();

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [rawSearchTerm, setRawSearchTerm] = useState(''); // Added for search input
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Added for debounced search

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(rawSearchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [rawSearchTerm]);
  
  // Combined filtering logic for tags and search
  const filteredTasks = React.useMemo(() => {
    const currentSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const currentActiveFilters = activeFilters.map(f => f.toLowerCase());

    if (currentActiveFilters.length === 0 && currentSearchTerm === '') {
      return tasks;
    }

    const filterWithHierarchy = (
      taskList: Task[],
      activeTagFilters: string[],
      searchTerm: string
    ): Task[] => {
      return taskList
        .map(task => {
          const filteredSubtasks = task.subtasks && task.subtasks.length > 0
            ? filterWithHierarchy(task.subtasks, activeTagFilters, searchTerm)
            : [];

          const taskTextMatchesSearch = searchTerm === '' || task.text.toLowerCase().includes(searchTerm);
          const taskNotesMatchesSearch = searchTerm === '' || (task.notes && task.notes.toLowerCase().includes(searchTerm));
          const taskTagsMatchSearch = searchTerm === '' || task.tags.some(tag => tag.toLowerCase().includes(searchTerm));
          const taskItselfMatchesSearch = taskTextMatchesSearch || taskNotesMatchesSearch || taskTagsMatchSearch;
          
          const taskItselfMatchesTags = activeTagFilters.length === 0 || 
            task.tags.some(tag => activeTagFilters.includes(tag.toLowerCase()));

          const taskItselfIsKept = taskItselfMatchesTags && taskItselfMatchesSearch;

          if (taskItselfIsKept || filteredSubtasks.length > 0) {
            return {
              ...task,
              subtasks: taskItselfIsKept ? (task.subtasks && task.subtasks.length > 0 ? filterWithHierarchy(task.subtasks, activeTagFilters, searchTerm) : []) : filteredSubtasks,
            };
          }
          return null;
        })
        .filter(task => task !== null) as Task[];
    };
    
    return filterWithHierarchy(tasks, currentActiveFilters, currentSearchTerm);

  }, [tasks, activeFilters, debouncedSearchTerm]);


  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 min-h-screen flex flex-col">
      <Header />
      <div className="my-6">
        <GlobalSearchBar 
          searchTerm={rawSearchTerm} 
          setSearchTerm={setRawSearchTerm} 
        />
      </div>
      <main className="flex-grow">
        <div className="mb-6 p-6 bg-card rounded-lg shadow">
           <h2 className="text-xl font-semibold mb-3 text-primary">Add New Task</h2>
          <NewTaskForm addTask={addTask} />
        </div>
        
        <div className="my-6 p-6 bg-card rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-primary">Filter by Tags</h2>
          <TagFilter tasks={tasks} activeFilters={activeFilters} setActiveFilters={setActiveFilters} />
        </div>

        <ChecklistView
          tasks={filteredTasks}
          isLoading={isLoading}
          toggleTaskCompletion={toggleTaskCompletion}
          deleteTask={deleteTask}
          editTask={editTask}
          updateTaskPriority={updateTaskPriority}
          addSubtask={addSubtask}
          setTasks={setTasks}
          saveTasks={saveTasks}
          searchTerm={debouncedSearchTerm.trim().toLowerCase()} // Pass search term
        />
      </main>
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Taskdown. Built for focus.</p>
      </footer>
    </div>
  );
}