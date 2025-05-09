"use client";

import type { Task, Priority } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Edit3, TagIcon, Flag, FlagOff, Check } from 'lucide-react';
import { ChecklistItemContent } from './ChecklistItemContent';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface ChecklistItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onUpdatePriority: (id: string, priority: Priority) => void;
}

const priorityConfig: Record<Priority, { label: string; iconClassName: string; itemClassName?: string }> = {
  high: { label: 'High', iconClassName: 'text-red-500', itemClassName: 'text-red-500 focus:text-red-500' },
  medium: { label: 'Medium', iconClassName: 'text-yellow-500', itemClassName: 'text-yellow-500 focus:text-yellow-500' },
  low: { label: 'Low', iconClassName: 'text-blue-500', itemClassName: 'text-blue-500 focus:text-blue-500' },
  none: { label: 'No Priority', iconClassName: 'text-muted-foreground' },
};

export function ChecklistItem({ task, onToggleComplete, onDelete, onEdit, onUpdatePriority }: ChecklistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const currentPriorityConfig = priorityConfig[task.priority || 'none'];

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-2 group transition-all duration-200 shadow-md hover:shadow-xl",
          isDragging && "opacity-80 shadow-2xl z-50"
        )}
      >
        <CardContent className="p-3 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="cursor-grab h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label="Drag to reorder"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Drag to reorder</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    {task.priority === 'none' || !task.priority ? (
                      <FlagOff className={`h-4 w-4 ${currentPriorityConfig.iconClassName}`} />
                    ) : (
                      <Flag className={`h-4 w-4 ${currentPriorityConfig.iconClassName}`} />
                    )}
                     <span className="sr-only">Set priority: {currentPriorityConfig.label}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Priority: {currentPriorityConfig.label}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Set Priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['high', 'medium', 'low', 'none'] as Priority[]).map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => onUpdatePriority(task.id, p)}
                  className={cn("cursor-pointer", priorityConfig[p].itemClassName)}
                >
                  {p === 'none' ? (
                    <FlagOff className={`h-4 w-4 mr-2 ${priorityConfig[p].iconClassName}`} />
                  ) : (
                    <Flag className={`h-4 w-4 mr-2 ${priorityConfig[p].iconClassName}`} />
                  )}
                  {priorityConfig[p].label}
                  {(task.priority || 'none') === p && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Checkbox
            id={`task-${task.id}`}
            checked={task.completed}
            onCheckedChange={() => onToggleComplete(task.id)}
            className="shrink-0"
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
