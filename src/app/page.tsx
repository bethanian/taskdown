"use client";

import React, { useState } from 'react';
import { Header } from '@/components/taskdown/Header';
import { NewTaskForm } from '@/components/taskdown/NewTaskForm';
import { ChecklistView } from '@/components/taskdown/ChecklistView';
import { useTasks } from '@/hooks/useTasks';
import { TagFilter } from '@/components/taskdown/TagFilter';
import type { Task } from '@/lib/types';

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

  const recursivelyFilterTasks = (tasksToFilter: Task[], currentFilters: string[]): Task[] => {
    if (currentFilters.length === 0) {
      return tasksToFilter;
    }
    
    return tasksToFilter.reduce((acc: Task[], task) => {
      // Check if the parent task matches
      const parentMatches = task.tags.some(tag => currentFilters.includes(tag.toLowerCase()));
      
      // Recursively filter subtasks
      const filteredSubtasks = task.subtasks ? recursivelyFilterTasks(task.subtasks, currentFilters) : [];
      
      // If parent matches or has matching subtasks, include it
      if (parentMatches || filteredSubtasks.length > 0) {
        acc.push({
          ...task,
          subtasks: filteredSubtasks // always include subtasks if parent is kept, even if they don't match
        });
      }
      return acc;
    }, []);
  };
  
  // Filter tasks based on active tags, ensuring parent tasks are kept if subtasks match
  const filteredTasks = React.useMemo(() => {
    if (activeFilters.length === 0) {
      return tasks;
    }
    // A slightly different approach: show a task if it OR any of its subtasks match.
    // This makes the filter more inclusive.
    const filterWithHierarchy = (taskList: Task[]): Task[] => {
        return taskList.map(task => {
            const subtasksMatch = task.subtasks && task.subtasks.length > 0 ? filterWithHierarchy(task.subtasks) : [];
            const taskItselfMatches = task.tags.some(tag => activeFilters.includes(tag.toLowerCase()));

            if (taskItselfMatches || (subtasksMatch && subtasksMatch.length > 0)) {
                // If the task itself matches, we show all its subtasks regardless of their tags.
                // If the task itself doesn't match, but some subtasks do, we show the task and only the matching subtasks.
                return {
                    ...task,
                    subtasks: taskItselfMatches ? task.subtasks : subtasksMatch
                };
            }
            return null; 
        }).filter(task => task !== null) as Task[];
    };
    
    return filterWithHierarchy(tasks);

  }, [tasks, activeFilters]);


  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 min-h-screen flex flex-col">
      <Header />
      <main className="mt-8 flex-grow">
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
          setTasks={setTasks} // For DND, ensure it uses the original tasks or handles filtering appropriately
          saveTasks={saveTasks} // Same as above
        />
      </main>
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Taskdown. Built for focus.</p>
      </footer>
    </div>
  );
}
