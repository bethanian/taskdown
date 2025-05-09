"use client";

import React from 'react';
import { Header } from '@/components/taskdown/Header';
import { NewTaskForm } from '@/components/taskdown/NewTaskForm';
import { ChecklistView } from '@/components/taskdown/ChecklistView';
import { useTasks } from '@/hooks/useTasks';
// Placeholder for TagFilter, can be developed later
// import { TagFilter } from '@/components/taskdown/TagFilter';

export default function TaskdownPage() {
  const { 
    tasks, 
    isLoading, 
    addTask, 
    toggleTaskCompletion, 
    deleteTask, 
    editTask, 
    updateTaskPriority, 
    setTasks, 
    saveTasks 
  } = useTasks();

  // Basic filtering logic (can be expanded)
  // const [activeFilters, setActiveFilters] = useState<string[]>([]);
  // const filteredTasks = tasks.filter(task => 
  //   activeFilters.length === 0 || task.tags.some(tag => activeFilters.includes(tag))
  // );

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 min-h-screen flex flex-col">
      <Header />
      <main className="mt-8 flex-grow">
        <div className="mb-6 p-6 bg-card rounded-lg shadow">
           <h2 className="text-xl font-semibold mb-3 text-primary">Add New Task</h2>
          <NewTaskForm addTask={addTask} />
        </div>
        
        {/* 
        <div className="my-6">
          <h2 className="text-lg font-semibold mb-2">Filter by Tags</h2>
          <TagFilter tasks={tasks} activeFilters={activeFilters} setActiveFilters={setActiveFilters} />
        </div>
        */}

        <ChecklistView
          tasks={tasks} // Replace with filteredTasks when filter is active
          isLoading={isLoading}
          toggleTaskCompletion={toggleTaskCompletion}
          deleteTask={deleteTask}
          editTask={editTask}
          updateTaskPriority={updateTaskPriority}
          setTasks={setTasks}
          saveTasks={saveTasks}
        />
      </main>
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Taskdown. Built for focus.</p>
      </footer>
    </div>
  );
}
