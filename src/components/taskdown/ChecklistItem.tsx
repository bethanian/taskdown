"use client";

import type { Task } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Edit3, TagIcon } from 'lucide-react';
import { ChecklistItemContent } from './ChecklistItemContent';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChecklistItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void; // Triggers edit mode/dialog
  // onFocus: () => void; // For keyboard navigation
  // isFocused?: boolean; // For keyboard navigation styling
}

export function ChecklistItem({ task, onToggleComplete, onDelete, onEdit }: ChecklistItemProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Card className="mb-2 group transition-shadow duration-200 hover:shadow-md">
        <CardContent className="p-3 flex items-start gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="cursor-grab h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity" aria-label="Drag to reorder">
                 <GripVertical className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Drag to reorder (not implemented)</TooltipContent>
          </Tooltip>
          <Checkbox
            id={`task-${task.id}`}
            checked={task.completed}
            onCheckedChange={() => onToggleComplete(task.id)}
            className="mt-1 shrink-0"
            aria-labelledby={`task-text-${task.id}`}
          />
          <div className="flex-grow space-y-1">
            <label htmlFor={`task-${task.id}`} className="sr-only">Task text</label>
            <div id={`task-text-${task.id}`} className="cursor-pointer" onClick={() => onToggleComplete(task.id)}>
                <ChecklistItemContent text={task.text} completed={task.completed} />
            </div>
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {task.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-8 w-8">
                  <Edit3 className="h-4 w-4" />
                  <span className="sr-only">Edit task</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit task</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-8 w-8 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete task</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete task</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
