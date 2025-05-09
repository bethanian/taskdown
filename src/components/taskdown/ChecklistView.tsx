"use client";

import React, { useState } from 'react';
import type { Task, Priority } from '@/lib/types';
import { ChecklistItem } from './ChecklistItem';
import { EditTaskDialog } from './EditTaskDialog';
import type { useTasks } from '@/hooks/useTasks'; // Import the hook type
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
  toggleTaskCompletion: ReturnType<typeof useTasks>['toggleTaskCompletion'];
  deleteTask: ReturnType<typeof useTasks>['deleteTask'];
  editTask: ReturnType<typeof useTasks>['editTask'];
  updateTaskPriority: ReturnType<typeof useTasks>['updateTaskPriority'];
  addSubtask: ReturnType<typeof useTasks>['addSubtask'];
  setTasks: ReturnType<typeof useTasks>['setTasks']; // For DND reordering
  saveTasks: ReturnType<typeof useTasks>['saveTasks']; // For persisting DND reordering
}

export function ChecklistView({ 
  tasks, 
  isLoading, 
  toggleTaskCompletion, 
  deleteTask, 
  editTask,
  updateTaskPriority,
  addSubtask,
  setTasks,
  saveTasks
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

  const handleSaveEdit = (id: string, newText: string, newTags: string[], newPriority: Priority) => {
    editTask(id, newText, newTags, newPriority);
    setIsEditDialogOpen(false);
    setEditingTask(null);
  };
  
  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (over && active.id !== over.id) {
      // Only allow dragging for top-level tasks
      const oldIndex = tasks.findIndex((task) => task.id === active.id && !task.subtasks?.some(st => st.id === active.id));
      const newIndex = tasks.findIndex((task) => task.id === over.id && !task.subtasks?.some(st => st.id === over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
        setTasks(reorderedTasks);
        saveTasks(reorderedTasks);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-sm" /> {/* Drag handle placeholder */}
              <Skeleton className="h-5 w-5 rounded-sm" /> {/* Priority placeholder */}
              <Skeleton className="h-5 w-5 rounded-sm" /> {/* Checkbox placeholder */}
              <Skeleton className="h-4 flex-grow" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <Image src="https://picsum.photos/seed/empty/300/200" alt="Empty checklist" width={300} height={200} className="rounded-lg mb-4 shadow-md" data-ai-hint="empty illustration" />
        <p className="text-lg">No tasks yet. Add one to get started!</p>
      </div>
    );
  }
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map(task => task.id)} // DND only for top-level items
        strategy={verticalListSortingStrategy}
      >
        <div>
          {tasks.map(task => (
            <ChecklistItem
              key={task.id}
              task={task}
              onToggleComplete={toggleTaskCompletion}
              onDelete={deleteTask}
              onEdit={handleEdit}
              onUpdatePriority={updateTaskPriority}
              onAddSubtask={addSubtask}
              depth={0} // Top-level tasks are at depth 0
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
