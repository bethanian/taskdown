"use client";

import type { Task, TaskStatus, Priority } from '@/lib/types';
import { KanbanCard } from './KanbanCard';
import { Droppable } from '@dnd-kit/core'; // For future DND
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'; // For future DND

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onUpdateTaskStatus: (id: string, newStatus: TaskStatus) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdatePriority: (id: string, priority: Priority) => void;
  onAddSubtask: (parentId: string, text: string, tags?: string[], priority?: Priority) => void;
  searchTerm?: string;
}

export function KanbanColumn({ 
  status, 
  tasks, 
  onEditTask, 
  // onUpdateTaskStatus, // Will be used by DND
  onToggleComplete,
  onDeleteTask,
  onUpdatePriority,
  onAddSubtask,
  searchTerm
}: KanbanColumnProps) {
  // const { setNodeRef } = useDroppable({ id: status }); // For DND

  return (
    <div 
      // ref={setNodeRef} // For DND
      className="bg-muted/50 p-4 rounded-lg shadow-md flex flex-col gap-4 min-h-[200px]"
    >
      <h2 className="text-lg font-semibold text-primary sticky top-0 bg-muted/50 py-2 -my-2 z-10">
        {status} ({tasks.length})
      </h2>
      <div className="space-y-3 overflow-y-auto flex-grow" style={{maxHeight: 'calc(100vh - 250px)'}}> {/* Adjust max height as needed */}
        {/* <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}> */}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks in this stage.</p>
          )}
          {tasks.map(task => (
            <KanbanCard 
              key={task.id} 
              task={task} 
              onEditTask={onEditTask} 
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
              onUpdatePriority={onUpdatePriority}
              onAddSubtask={onAddSubtask}
              searchTerm={searchTerm}
            />
          ))}
        {/* </SortableContext> */}
      </div>
    </div>
  );
}
