// src/components/taskdown/KanbanCard.tsx
"use client";

import React from 'react';
import type { Task, Priority } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit3, Trash2, TagIcon, FlagIcon, User, Share2, CalendarDays, FileText, Paperclip, LinkIcon, CheckCircle, Circle } from 'lucide-react'; // Removed FlagOff, Plus
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from '@/components/ui/progress';
import { MarkdownWithHighlight, HighlightedText } from './MarkdownWithHighlight';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, differenceInCalendarDays } from 'date-fns';
// import { useSortable } from '@dnd-kit/sortable'; // For future DND
// import { CSS } from '@dnd-kit/utilities'; // For future DND

interface KanbanCardProps {
  task: Task;
  onEditTask: (task: Task) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdatePriority: (id: string, priority: Priority) => void;
  onAddSubtask: (parentId: string, text: string, tags?: string[], priority?: Priority) => void;
  onGenerateShareLink: (taskId: string) => Promise<string | null>;
  searchTerm?: string;
}

const priorityConfig: Record<Priority, { label: string; iconClassName: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  high: { label: 'High', iconClassName: 'text-red-500', badgeVariant: 'destructive' },
  medium: { label: 'Medium', iconClassName: 'text-yellow-500', badgeVariant: 'secondary' }, 
  low: { label: 'Low', iconClassName: 'text-blue-500', badgeVariant: 'default' }, 
  none: { label: 'No Priority', iconClassName: 'text-muted-foreground', badgeVariant: 'outline' },
};

function getUrlHostname(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (e) {
    return url; 
  }
}

function getDueDateInfo(dueDateTimestamp?: number, completed?: boolean): { text: string, className: string, tooltip: string } | null {
  if (!dueDateTimestamp) return null;
  if (completed) return { text: format(new Date(dueDateTimestamp), "MMM d"), className: "text-green-600", tooltip: `Completed, Due: ${format(new Date(dueDateTimestamp), "PPP")}`};
  
  const dueDateObj = new Date(dueDateTimestamp);
  const today = new Date();

  if (isPast(dueDateObj) && !isToday(dueDateObj)) {
    return { text: format(dueDateObj, "MMM d"), className: "text-red-500 font-semibold", tooltip: `Overdue: ${format(dueDateObj, "PPP")}` };
  }
  if (isToday(dueDateObj)) {
    return { text: "Today", className: "text-orange-500 font-semibold", tooltip: `Due Today: ${format(dueDateObj, "PPP")}` };
  }
   const diffDays = differenceInCalendarDays(dueDateObj, today);
  if (diffDays === 1) {
     return { text: "Tomorrow", className: "text-yellow-600", tooltip: `Due Tomorrow: ${format(dueDateObj, "PPP")}` };
  }
  if (diffDays > 0 && diffDays <= 7) {
     return { text: `In ${diffDays} days`, className: "text-blue-600", tooltip: `Due: ${format(dueDateObj, "PPP")}` };
  }
  return { text: format(dueDateObj, "MMM d"), className: "text-muted-foreground", tooltip: `Due: ${format(dueDateObj, "PPP")}` };
}


export function KanbanCard({ 
  task, 
  onEditTask, 
  onToggleComplete,
  onDeleteTask,
  // onUpdatePriority, // This might be better handled in the edit dialog for Kanban card
  // onAddSubtask, // Subtask adding might be complex for a small card, better in edit dialog
  onGenerateShareLink,
  searchTerm 
}: KanbanCardProps) {
  // const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id }); // For DND
  // const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.8 : 1, }; // For DND

  const currentPriorityConfig = priorityConfig[task.priority || 'none'];
  const dueDateInfo = getDueDateInfo(task.dueDate, task.completed);

  const calculateSubtaskProgress = (subtasks: Task[] | undefined): number | null => {
    if (!subtasks || subtasks.length === 0) return null;
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    return (completedSubtasks / subtasks.length) * 100;
  };
  const subtaskProgress = calculateSubtaskProgress(task.subtasks);
  const completedSubtaskCount = task.subtasks?.filter(st => st.completed).length || 0;
  const totalSubtaskCount = task.subtasks?.length || 0;

  const hasNotes = task.notes && task.notes.trim() !== '';
  const hasAttachments = task.attachments && task.attachments.length > 0;


  return (
    <TooltipProvider delayDuration={300}>
      <Card 
        // ref={setNodeRef} style={style} {...attributes} {...listeners} // For DND
        className="bg-card shadow-lg hover:shadow-xl transition-shadow duration-200"
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex justify-between items-start gap-2">
            <div 
              className={cn(
                "flex items-center gap-2 cursor-pointer flex-grow min-w-0", 
                task.completed && "text-muted-foreground line-through"
              )}
              onClick={() => onToggleComplete(task.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggleComplete(task.id)}
              aria-pressed={task.completed}
              aria-label={task.completed ? `Mark task as incomplete: ${task.text}` : `Mark task as complete: ${task.text}`}
            >
              {task.completed ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
              <CardTitle className="text-sm font-semibold leading-tight flex-grow min-w-0">
                <HighlightedText text={task.text} highlight={searchTerm} />
              </CardTitle>
            </div>
            <div className="flex gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onEditTask(task)} className="h-7 w-7">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Task</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onGenerateShareLink(task.id)} className="h-7 w-7">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share Task (copy link)</TooltipContent>
                </Tooltip>
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteTask(task.id)} className="h-7 w-7 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Task</TooltipContent>
                </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          
          <div className="flex flex-wrap gap-2 items-center">
             {dueDateInfo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={cn("text-xs py-1 px-2 items-center", dueDateInfo.className)}>
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {dueDateInfo.text}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent><p>{dueDateInfo.tooltip}</p></TooltipContent>
              </Tooltip>
            )}
            {task.priority !== 'none' && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant={currentPriorityConfig.badgeVariant} className="text-xs py-0.5 px-1.5">
                    <FlagIcon className={`h-3 w-3 mr-1 ${currentPriorityConfig.iconClassName}`} />
                    {currentPriorityConfig.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Priority: {currentPriorityConfig.label}</TooltipContent>
              </Tooltip>
            )}
            {task.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs py-0.5 px-1.5">
                <TagIcon className="h-3 w-3 mr-1" />
                <HighlightedText text={tag} highlight={searchTerm} />
              </Badge>
            ))}
             {task.assignedTo && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs py-0.5 px-1.5 flex items-center">
                      <User className="h-3 w-3 mr-1 text-muted-foreground" />
                       <HighlightedText text={task.assignedTo} highlight={searchTerm} />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Assigned to: {task.assignedTo}</TooltipContent>
                </Tooltip>
              )}
          </div>

          {hasNotes && (
             <Tooltip>
                <TooltipTrigger className="flex items-center text-xs text-muted-foreground cursor-default">
                    <FileText className="h-3.5 w-3.5 mr-1" /> Notes included
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-xs">
                    <p className="font-semibold mb-1">Notes:</p>
                    <div className="prose prose-xs dark:prose-invert max-w-none">
                        <MarkdownWithHighlight markdownText={task.notes!.length > 100 ? task.notes!.substring(0, 100) + '...' : task.notes!} searchTerm={searchTerm} />
                    </div>
                    {task.notes!.length > 100 && <p className="text-xs italic mt-1">Click edit to see full notes.</p>}
                </TooltipContent>
            </Tooltip>
          )}

          {hasAttachments && (
            <Tooltip>
              <TooltipTrigger className="flex items-center text-xs text-muted-foreground cursor-default">
                <Paperclip className="h-3.5 w-3.5 mr-1" /> {task.attachments!.length} Attachment(s)
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                <p className="font-semibold mb-1">Attachments:</p>
                <ul className="list-none p-0 space-y-0.5">
                {task.attachments!.slice(0,3).map(att => (
                    <li key={att.id} className="flex items-center text-xs">
                        <LinkIcon className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                        <span className="truncate" title={att.value}>{att.name || getUrlHostname(att.value)}</span>
                    </li>
                ))}
                {task.attachments!.length > 3 && <li className="text-xs italic">...and more</li>}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}


          {subtaskProgress !== null && (
            <div className="mt-1">
              <Tooltip>
                <TooltipTrigger className="w-full">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                    <span>Subtasks</span>
                    <span>{completedSubtaskCount}/{totalSubtaskCount}</span>
                  </div>
                  <Progress value={subtaskProgress} className="h-1.5 w-full" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{Math.round(subtaskProgress)}% of subtasks complete.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
