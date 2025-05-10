// src/components/taskdown/KanbanView.tsx
"use client";

import React, { useState } from 'react';
import type { Task, TaskStatus, Priority, Attachment, RecurrenceRule } from '@/lib/types';
import { TASK_STATUS_OPTIONS } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { EditTaskDialog } from './EditTaskDialog'; 
import type { useTasks } from '@/hooks/useTasks'; // Import useTasks for ReturnType
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
// import { DndContext, closestCenter } from '@dnd-kit/core'; // For future DND

interface KanbanViewProps {
  tasks: Task[];
  isLoading: boolean;
  onEditTask: (
    id: string, 
    text: string, 
    tags: string[], 
    priority: Priority, 
    notes: string, 
    attachments: Attachment[], 
    status: TaskStatus, 
    assignedTo: string | undefined, 
    dueDate: number | undefined,
    recurrence: RecurrenceRule,
    dependentOnId: string | null // Added dependentOnId
  ) => void;
  onUpdateTaskStatus: (id: string, newStatus: TaskStatus) => void;
  onToggleComplete: ReturnType<typeof useTasks>['toggleComplete']; 
  onDeleteTask: (id: string) => void;
  onUpdatePriority: ReturnType<typeof useTasks>['updateTaskPriority']; 
  onAddSubtask: ReturnType<typeof useTasks>['addSubtask'];         
  onGenerateShareLink: ReturnType<typeof useTasks>['generateShareLink']; 
  searchTerm?: string;
}

export function KanbanView({ 
  tasks, 
  isLoading, 
  onEditTask, 
  onUpdateTaskStatus,
  onToggleComplete, 
  onDeleteTask,
  onUpdatePriority,
  onAddSubtask,
  onGenerateShareLink,
  searchTerm
}: KanbanViewProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = (
    id: string, 
    newText: string, 
    newTags: string[], 
    newPriority: Priority,
    newNotes: string,
    newAttachments: Attachment[],
    newStatus: TaskStatus,
    newAssignedTo: string | undefined,
    newDueDate: number | undefined,
    newRecurrence: RecurrenceRule,
    newDependentOnId: string | null // Added dependentOnId
  ) => {
    onEditTask(id, newText, newTags, newPriority, newNotes, newAttachments, newStatus, newAssignedTo, newDueDate, newRecurrence, newDependentOnId);
    setIsEditDialogOpen(false);
    setEditingTask(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUS_OPTIONS.map(status => (
          <div key={status} className="bg-card p-4 rounded-lg shadow">
            <Skeleton className="h-6 w-1/2 mb-4" />
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0 && !searchTerm) {
     return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <Image src="https://picsum.photos/seed/emptykanban/300/200" alt="Empty Kanban board" width={300} height={200} className="rounded-lg mb-4 shadow-md" data-ai-hint="empty board" />
        <p className="text-lg">No tasks to display on the board. Add some tasks!</p>
      </div>
    );
  }
  
  if (tasks.length === 0 && searchTerm) {
     return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <Image src="https://picsum.photos/seed/noresultskanban/300/200" alt="No results found" width={300} height={200} className="rounded-lg mb-4 shadow-md" data-ai-hint="no results" />
        <p className="text-lg">No tasks match your search for the board view.</p>
      </div>
    );
  }

  // Group tasks by status for Kanban columns
  const tasksByStatus = tasks.reduce((acc, task) => {
    const status = task.status || TASK_STATUS_OPTIONS[0]; // Default to the first status if undefined
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(task);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    // <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
      {TASK_STATUS_OPTIONS.map(status => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={tasksByStatus[status] || []}
          onEditTask={handleEdit}
          onUpdateTaskStatus={onUpdateTaskStatus}
          onToggleComplete={onToggleComplete}
          onDeleteTask={onDeleteTask}
          onUpdatePriority={onUpdatePriority}
          onAddSubtask={onAddSubtask}
          onGenerateShareLink={onGenerateShareLink}
          searchTerm={searchTerm}
        />
      ))}
      {editingTask && (
        <EditTaskDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          task={editingTask}
          allTasks={tasks} // Pass all tasks for dependency dropdown
          onSave={handleSaveEdit}
        />
      )}
    </div>
    // </DndContext>
  );
}
