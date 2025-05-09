"use client";

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/taskdown/Header';
import { NewTaskForm } from '@/components/taskdown/NewTaskForm';
import { ChecklistView } from '@/components/taskdown/ChecklistView';
import { KanbanView } from '@/components/taskdown/KanbanView'; 
import { useTasks } from '@/hooks/useTasks';
import { TagFilter } from '@/components/taskdown/TagFilter';
import type { Task } from '@/lib/types';
import { GlobalSearchBar } from '@/components/taskdown/GlobalSearchBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { List, LayoutGrid, Sparkles } from 'lucide-react'; 
import { AiTaskInputForm } from '@/components/taskdown/AiTaskInputForm';
import { processTaskInput, type ProcessTaskInput, type ProcessTaskOutput } from '@/ai/flows/process-task-input-flow';


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
    updateTaskStatus,
    assignTask,
    generateShareLink,
    setTasks, 
    saveTasks,
    applyAiTaskOperations,
  } = useTasks();

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [rawSearchTerm, setRawSearchTerm] = useState(''); 
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(rawSearchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [rawSearchTerm]);
  
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
          const taskAssignedToMatchesSearch = searchTerm === '' || (task.assignedTo && task.assignedTo.toLowerCase().includes(searchTerm));
          const taskItselfMatchesSearch = taskTextMatchesSearch || taskNotesMatchesSearch || taskTagsMatchSearch || taskAssignedToMatchesSearch;
          
          const taskItselfMatchesTags = activeTagFilters.length === 0 || 
            task.tags.some(tag => activeTagFilters.includes(tag.toLowerCase()));

          const taskItselfIsKept = taskItselfMatchesTags && taskItselfMatchesSearch;

          if (taskItselfIsKept || filteredSubtasks.length > 0) {
            return {
              ...task,
              subtasks: taskItselfIsKept ? (task.subtasks && task.subtasks.length > 0 ? filterWithHierarchy(task.subtasks, [], searchTerm) : []) : filteredSubtasks, 
            };
          }
          return null;
        })
        .filter(task => task !== null) as Task[];
    };
    
    return filterWithHierarchy(tasks, currentActiveFilters, currentSearchTerm);

  }, [tasks, activeFilters, debouncedSearchTerm]);

  const handleAiProcessTasks = async (input: ProcessTaskInput): Promise<ProcessTaskOutput | null> => {
    try {
      const output = await processTaskInput(input);
      if (output) {
        await applyAiTaskOperations(output);
      }
      return output;
    } catch (e) {
      console.error("Error processing AI tasks in page:", e);
      // Toasting is handled in AiTaskInputForm or applyAiTaskOperations
      return null;
    }
  };


  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 min-h-screen flex flex-col">
      <Header />
      <div className="my-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-auto flex-grow">
         <GlobalSearchBar 
            searchTerm={rawSearchTerm} 
            setSearchTerm={setRawSearchTerm} 
          />
        </div>
        <Tabs defaultValue="list" value={activeView} onValueChange={(value) => setActiveView(value as 'list' | 'kanban')} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" /> List
            </TabsTrigger>
            <TabsTrigger value="kanban" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" /> Kanban
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <main className="flex-grow">
        <div className="mb-6 p-6 bg-card rounded-lg shadow">
           <h2 className="text-xl font-semibold mb-3 text-primary">Add New Task</h2>
          <NewTaskForm addTask={addTask} />
        </div>

        <div className="mb-6 p-6 bg-card rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3 text-primary flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-primary" /> AI Task Assistant
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Try: "Create Design phase with subtasks: Sketches, Wireframes. Add task: Call John. Remove: Old team meeting."
          </p>
          <AiTaskInputForm onProcessTasks={handleAiProcessTasks} disabled={isLoading} />
        </div>
        
        <div className="mb-6 p-6 bg-card rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-primary">Filter by Tags</h2>
          <TagFilter tasks={tasks} activeFilters={activeFilters} setActiveFilters={setActiveFilters} />
        </div>

        {activeView === 'list' && (
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
            searchTerm={debouncedSearchTerm.trim().toLowerCase()}
            onGenerateShareLink={generateShareLink}
          />
        )}
        {activeView === 'kanban' && (
          <KanbanView
            tasks={filteredTasks} 
            isLoading={isLoading}
            onEditTask={editTask} 
            onUpdateTaskStatus={updateTaskStatus} 
            onToggleComplete={toggleTaskCompletion}
            onDeleteTask={deleteTask}
            onUpdatePriority={updateTaskPriority}
            onAddSubtask={addSubtask}
            onGenerateShareLink={generateShareLink}
            searchTerm={debouncedSearchTerm.trim().toLowerCase()}
          />
        )}
      </main>
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Taskdown. Built for focus.</p>
      </footer>
    </div>
  );
}
