// src/components/taskdown/ChecklistView.tsx
"use client";

import React, { useState } from 'react';
import type { Task, Priority, Attachment, TaskStatus, RecurrenceRule } from '@/lib/types';
import type { TaskUpdate } from '@/lib/tasks';
import { ChecklistItem } from './ChecklistItem';
import { EditTaskDialog } from './EditTaskDialog';
import type { useTasks } from '@/hooks/useTasks'; 
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface ChecklistViewProps {
  tasks: Task[]; 
  isLoading: boolean;
  onToggleComplete: ReturnType<typeof useTasks>['toggleComplete'];
  deleteTask: ReturnType<typeof useTasks>['deleteTask'];
  updateTask: ReturnType<typeof useTasks>['updateTask'];
  onUpdatePriority: ReturnType<typeof useTasks>['updateTaskPriority'];
  onAddSubtask: ReturnType<typeof useTasks>['addSubtask'];
  onGenerateShareLink: ReturnType<typeof useTasks>['generateShareLink'];
  searchTerm?: string;
}

export function ChecklistView({ 
  tasks, 
  isLoading, 
  onToggleComplete,
  deleteTask, 
  updateTask,
  onUpdatePriority,
  onAddSubtask,
  onGenerateShareLink,
  searchTerm,
}: ChecklistViewProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    newDueDateMs: number | undefined,
    newRecurrence: RecurrenceRule // Added recurrence
  ) => {
    const updates: TaskUpdate = {
      title: newText,
      tags: newTags,
      priority: newPriority,
      notes: newNotes,
      attachments: newAttachments,
      status: newStatus,
      assigned_to: newAssignedTo === "" ? null : newAssignedTo,
      due_date: newDueDateMs ? new Date(newDueDateMs).toISOString() : null,
      recurrence: newRecurrence, // Added recurrence
    };
    updateTask(id, updates);
    setIsEditDialogOpen(false);
    setEditingTask(null);
  };
  
  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (over && active.id !== over.id) {
      console.warn("Visual drag-and-drop reordering occurred, but changes are not persisted to the backend with this handler.");
      // To persist changes, you would call a function here that updates the order in Supabase.
      // This typically involves adding an 'order' or 'position' field to your tasks table
      // and then updating these fields for the affected tasks.
      // For example: updateTaskOrder(active.id, over.id, tasks);
      // The local state update could be:
      // setTasks((currentTasks) => {
      //   const oldIndex = currentTasks.findIndex((task) => task.id === active.id);
      //   const newIndex = currentTasks.findIndex((task) => task.id === over.id);
      //   return arrayMove(currentTasks, oldIndex, newIndex);
      // });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-sm" />
              <Skeleton className="h-5 w-5 rounded-sm" />
              <Skeleton className="h-5 w-5 rounded-sm" />
              <Skeleton className="h-4 flex-grow" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0 && !searchTerm) { 
    return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <Image src="https://picsum.photos/seed/empty/300/200" alt="Empty checklist" width={300} height={200} className="rounded-lg mb-4 shadow-md" data-ai-hint="empty illustration" />
        <p className="text-lg">No tasks yet. Add one to get started!</p>
      </div>
    );
  }

  if (tasks.length === 0 && searchTerm) { 
     return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <Image src="https://picsum.photos/seed/noresults/300/200" alt="No results found" width={300} height={200} className="rounded-lg mb-4 shadow-md" data-ai-hint="no results" />
        <p className="text-lg">No tasks match your search.</p>
      </div>
    );
  }
  
  const topLevelTaskIds = tasks.filter(task => !task.subtasks?.some(st => tasks.find(t => t.id === st.id))).map(task => task.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={topLevelTaskIds} 
        strategy={verticalListSortingStrategy}
      >
        <div>
          {tasks.map(task => ( 
            <ChecklistItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onDelete={deleteTask}
              onEdit={handleEdit}
              onUpdatePriority={onUpdatePriority}
              onAddSubtask={onAddSubtask}
              onGenerateShareLink={onGenerateShareLink}
              depth={0} 
              searchTerm={searchTerm}
            />
          ))}
        </div>
      </SortableContext>
      {editingTask && (
        <EditTaskDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          task={editingTask}
          onSave={handleSaveEdit}
        />
      )}
    </DndContext>
  );
}

```