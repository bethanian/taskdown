"use client";

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/taskdown/Header';
import { NewTaskForm } from '@/components/taskdown/NewTaskForm';
import { ChecklistView } from '@/components/taskdown/ChecklistView';
import { KanbanView } from '@/components/taskdown/KanbanView'; 
import { useTasks } from '@/hooks/useTasks';
import { TagFilter } from '@/components/taskdown/TagFilter';
import type { Task, Priority, Attachment, TaskStatus } from '@/lib/types';
import type { TaskUpdate } from '@/lib/tasks';
import { GlobalSearchBar } from '@/components/taskdown/GlobalSearchBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { List, LayoutGrid, Sparkles } from 'lucide-react'; 
import { AiTaskInputForm } from '@/components/taskdown/AiTaskInputForm';
import type { ProcessTaskInput, ProcessTaskOutput } from '@/ai/flows/process-task-input-flow';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, differenceInCalendarDays } from 'date-fns';


export default function TaskdownPage() {
  const { 
    tasks, 
    isLoading, 
    addTask,
    addSubtask,
    toggleComplete,
    deleteTask,
    updateTask,
    updateTaskPriority,
    generateShareLink,
    processAiInput
  } = useTasks();

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [rawSearchTerm, setRawSearchTerm] = useState(''); 
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'kanban'>('list');
  const [remindedTaskIds, setRemindedTaskIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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

  useEffect(() => {
    if (isLoading || tasks.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      let newRemindersShown = false;
      const newRemindedIds = new Set(remindedTaskIds);

      const showReminderRecursive = (taskList: Task[]) => {
        for (const task of taskList) {
          if (task.dueDate && !task.completed && !newRemindedIds.has(task.id)) {
            const dueDateObj = new Date(task.dueDate);
            const diffDays = differenceInCalendarDays(dueDateObj, now);
            
            if (isPast(dueDateObj) && !isToday(dueDateObj)) { 
              toast({
                title: "Task Overdue!",
                description: `"${task.text}" was due on ${format(dueDateObj, "PPP")}.`,
                variant: "destructive",
              });
              newRemindedIds.add(task.id);
              newRemindersShown = true;
            } else if (isToday(dueDateObj)) { 
              toast({
                title: "Reminder: Task Due Today!",
                description: `"${task.text}" is due today.`,
              });
              newRemindedIds.add(task.id);
              newRemindersShown = true;
            } else if (diffDays === 1) { // Due tomorrow
               toast({
                title: "Reminder: Task Due Tomorrow",
                description: `"${task.text}" is due tomorrow, ${format(dueDateObj, "PPP")}.`,
              });
              newRemindedIds.add(task.id);
              newRemindersShown = true;
            }
             else if (diffDays > 1 && diffDays <= 7) { // Due in 2-7 days
              toast({
                title: "Reminder: Task Due Soon",
                description: `"${task.text}" is due in ${diffDays} days, on ${format(dueDateObj, "PPP")}.`,
              });
              newRemindedIds.add(task.id);
              newRemindersShown = true;
            }
          }
          if (task.subtasks) {
            showReminderRecursive(task.subtasks);
          }
        }
      };
      
      showReminderRecursive(tasks);
      if(newRemindersShown) {
        setRemindedTaskIds(newRemindedIds);
      }
    };

    const timerId = setTimeout(checkReminders, 2000); // Check shortly after tasks load/change

    return () => {
      clearTimeout(timerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isLoading, toast]); // remindedTaskIds is intentionally omitted to allow re-triggering on task changes. Set inside.

  // --- Wrapper functions for editTask --- 
  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    updateTask(taskId, { status });
  };

  // Wrapper for KanbanView's onEditTask prop
  const handleKanbanEditTask = (
    id: string, 
    text: string, 
    tags: string[], 
    priority: Priority, 
    notes: string, 
    attachments: Attachment[], 
    status: TaskStatus, 
    assignedTo: string | undefined, 
    dueDateMs: number | undefined
  ) => {
    const updates: TaskUpdate = {
      title: text,
      tags,
      priority,
      notes,
      attachments,
      status,
      assigned_to: assignedTo,
      due_date: dueDateMs ? new Date(dueDateMs).toISOString() : null
    };
    updateTask(id, updates);
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
          <AiTaskInputForm onProcessTasks={processAiInput} disabled={isLoading} /> 
        </div>
        
        <div className="mb-6 p-6 bg-card rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-primary">Filter by Tags</h2>
          <TagFilter tasks={tasks} activeFilters={activeFilters} setActiveFilters={setActiveFilters} />
        </div>

        {activeView === 'list' && (
          <ChecklistView
            tasks={filteredTasks}
            isLoading={isLoading}
            onToggleComplete={toggleComplete}
            deleteTask={deleteTask}
            updateTask={updateTask}
            onUpdatePriority={updateTaskPriority}
            onAddSubtask={addSubtask}
            searchTerm={debouncedSearchTerm.trim().toLowerCase()}
            onGenerateShareLink={generateShareLink}
          />
        )}
        {activeView === 'kanban' && (
          <KanbanView
            tasks={filteredTasks} 
            isLoading={isLoading}
            onEditTask={handleKanbanEditTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onToggleComplete={toggleComplete}
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
