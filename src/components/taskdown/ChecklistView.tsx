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
    newRecurrence: RecurrenceRule,
    newDependentOnId: string | null 
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
      recurrence: newRecurrence,
      dependent_on: newDependentOnId,
    };
    updateTask(id, updates);
    setIsEditDialogOpen(false);
    setEditingTask(null);
  };
  
  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((task) => task.id === active.id);
      const newIndex = tasks.findIndex((task) => task.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // This is where you would call a function to persist the new order.
        // For now, we'll just log it as persistence is handled by useTasks or backend.
        console.warn("Task reorder attempted. Persistence for drag-and-drop is not yet fully implemented in useTasks.");
        // Example of how you might update local state if not relying on immediate backend re-fetch:
        // setTasks((currentTasks) => arrayMove(currentTasks, oldIndex, newIndex));
      }
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
  
  // Filter out subtasks from the main list for SortableContext if they are rendered recursively
  const topLevelTaskIds = tasks.filter(task => !task.subtasks?.some(st => tasks.find(t => t.id === st.id))).map(task => task.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={topLevelTaskIds} // Only top-level tasks are directly sortable here
        strategy={verticalListSortingStrategy}
      >
        <div>
          {tasks.map(task => ( // Render all tasks, ChecklistItem handles its own depth/subtasks
            <ChecklistItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onDelete={deleteTask}
              onEdit={handleEdit}
              onUpdatePriority={onUpdatePriority}
              onAddSubtask={onAddSubtask}
              onGenerateShareLink={onGenerateShareLink}
              depth={0} // Top-level tasks have depth 0
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
          allTasks={tasks} // Pass all tasks for dependency dropdown
          onSave={handleSaveEdit}
        />
      )}
    </DndContext>
  );
}
