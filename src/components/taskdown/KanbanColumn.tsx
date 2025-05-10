"use client";

import type { Task, TaskStatus, Priority } from '@/lib/types';
import { KanbanCard } from './KanbanCard';
import { useDroppable } from '@dnd-kit/core'; // CORRECTED IMPORT: Was Droppable
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'; // For future DND
import type { useTasks } from '@/hooks/useTasks'; // Import useTasks for ReturnType

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onUpdateTaskStatus: (id: string, newStatus: TaskStatus) => void;
  onToggleComplete: ReturnType<typeof useTasks>['toggleComplete']; // CORRECTED SIGNATURE
  onDeleteTask: (id: string) => void;
  onUpdatePriority: ReturnType<typeof useTasks>['updateTaskPriority']; // Match type from useTasks
  onAddSubtask: ReturnType<typeof useTasks>['addSubtask'];         // Match type from useTasks
  onGenerateShareLink: ReturnType<typeof useTasks>['generateShareLink']; // Match type from useTasks
  searchTerm?: string;
}

export function KanbanColumn({ 
  status, 
  tasks, 
  onEditTask, 
  // onUpdateTaskStatus, // Will be used by DND
  onToggleComplete, // This prop now has the correct type
  onDeleteTask,
  onUpdatePriority,
  onAddSubtask,
  onGenerateShareLink,
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
      <div className="space-y-3 overflow-y-auto flex-grow" style={{maxHeight: 'calc(100vh - 250px)'}}>
        {/* <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}> */}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks in this stage.</p>
          )}
          {tasks.map(task => (
            <KanbanCard 
              key={task.id} 
              task={task} 
              onEditTask={onEditTask} 
              onToggleComplete={onToggleComplete} // Passed down with correct signature
              onDeleteTask={onDeleteTask}
              onUpdatePriority={onUpdatePriority}
              onAddSubtask={onAddSubtask}
              onGenerateShareLink={onGenerateShareLink}
              searchTerm={searchTerm}
            />
          ))}
        {/* </SortableContext> */}
      </div>
    </div>
  );
}
