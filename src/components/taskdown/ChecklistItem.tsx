// src/components/taskdown/ChecklistItem.tsx
"use client";

import React, { useState } from 'react';
import type { Task, Priority, Attachment } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Edit3, TagIcon, FlagIcon, FlagOff, Check, Plus, ChevronDown, FileText, LinkIcon, Paperclip, User, Share2, CalendarDays } from 'lucide-react';
import { ChecklistItemContent } from './ChecklistItemContent';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from '@/components/ui/progress'; 
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { MarkdownWithHighlight, HighlightedText } from './MarkdownWithHighlight';
import { format, isPast, isToday, differenceInCalendarDays } from 'date-fns';

interface ChecklistItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onUpdatePriority: (id: string, priority: Priority) => void;
  onAddSubtask: (parentId: string, text: string, tags?: string[], priority?: Priority) => void;
  onGenerateShareLink: (taskId: string) => Promise<string | null>;
  depth?: number;
  searchTerm?: string;
}

const priorityConfig: Record<Priority, { label: string; iconClassName: string; itemClassName?: string }> = {
  high: { label: 'High', iconClassName: 'text-red-500', itemClassName: 'text-red-500 focus:text-red-500' },
  medium: { label: 'Medium', iconClassName: 'text-yellow-500', itemClassName: 'text-yellow-500 focus:text-yellow-500' },
  low: { label: 'Low', iconClassName: 'text-blue-500', itemClassName: 'text-blue-500 focus:text-blue-500' },
  none: { label: 'No Priority', iconClassName: 'text-muted-foreground' },
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


export function ChecklistItem({ 
  task, 
  onToggleComplete, 
  onDelete, 
  onEdit, 
  onUpdatePriority,
  onAddSubtask,
  onGenerateShareLink,
  depth = 0,
  searchTerm,
}: ChecklistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: depth > 0 }); 

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: depth > 0 ? `${depth * 1.5}rem` : undefined, 
  };
  
  const currentPriorityConfig = priorityConfig[task.priority || 'none'];
  const dueDateInfo = getDueDateInfo(task.dueDate, task.completed);

  const [showAddSubtaskInput, setShowAddSubtaskInput] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const calculateSubtaskProgress = (subtasks: Task[] | undefined): number | null => {
    if (!subtasks || subtasks.length === 0) {
      return null;
    }
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    return (completedSubtasks / subtasks.length) * 100;
  };

  const subtaskProgress = calculateSubtaskProgress(task.subtasks);

  const handleAddSubtaskSubmit = () => {
    if (newSubtaskText.trim()) {
      onAddSubtask(task.id, newSubtaskText.trim());
      setNewSubtaskText('');
      setShowAddSubtaskInput(false);
    }
  };
  
  const hasDetails = (task.notes && task.notes.trim() !== '') || (task.attachments && task.attachments.length > 0);

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-2 group transition-all duration-200 shadow-md hover:shadow-xl",
          isDragging && "opacity-80 shadow-2xl z-50",
          depth > 0 && "bg-card/90" 
        )}
      >
        <CardContent className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {depth === 0 && ( 
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
            )}
            {depth > 0 && <div className="w-8 shrink-0"></div>} 

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      {task.priority === 'none' || !task.priority ? (
                        <FlagOff className={`h-4 w-4 ${currentPriorityConfig.iconClassName}`} />
                      ) : (
                        <FlagIcon className={`h-4 w-4 ${currentPriorityConfig.iconClassName}`} />
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
                      <FlagIcon className={`h-4 w-4 mr-2 ${priorityConfig[p].iconClassName}`} />
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
            
            <div className="flex-grow space-y-1 min-w-0"> 
              <label htmlFor={`task-${task.id}`} className="sr-only">Task text</label>
              <div id={`task-text-${task.id}`} className="cursor-pointer flex items-center justify-between gap-x-2" onClick={() => onToggleComplete(task.id)}>
                <div className="flex-grow min-w-0">
                    <ChecklistItemContent text={task.text} completed={task.completed} searchTerm={searchTerm} />
                </div>
                {subtaskProgress !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-20 h-2 shrink-0" aria-label={`Subtask progress: ${Math.round(subtaskProgress)}%`}>
                        <Progress value={subtaskProgress} className="h-full w-full" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{`${Math.round(subtaskProgress)}% complete (${task.subtasks?.filter(st => st.completed).length || 0}/${task.subtasks?.length || 0} subtasks)`}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                {dueDateInfo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={cn("text-xs py-0.5 px-1.5 items-center", dueDateInfo.className)}>
                        <CalendarDays className="h-3 w-3 mr-1" />
                        {dueDateInfo.text}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent><p>{dueDateInfo.tooltip}</p></TooltipContent>
                  </Tooltip>
                )}
                {task.tags && task.tags.length > 0 && task.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <TagIcon className="h-3 w-3 mr-1" />
                    <HighlightedText text={tag} highlight={searchTerm} />
                  </Badge>
                ))}
                {task.assignedTo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs flex items-center">
                        <User className="h-3 w-3 mr-1 text-muted-foreground" />
                        <HighlightedText text={task.assignedTo} highlight={searchTerm} />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Assigned to: {task.assignedTo}</TooltipContent>
                  </Tooltip>
                )}
              </div>
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
                  <Button variant="ghost" size="icon" onClick={() => setShowAddSubtaskInput(prev => !prev)} className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add subtask</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add subtask</TooltipContent>
              </Tooltip>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onGenerateShareLink(task.id)} className="h-8 w-8">
                    <Share2 className="h-4 w-4" />
                    <span className="sr-only">Share task</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share task (copy link)</TooltipContent>
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
          </div>

          {/* Subtasks and Details Accordion Area */}
          {(showAddSubtaskInput || (task.subtasks && task.subtasks.length > 0) || hasDetails) && (
            <div className="pl-8 mt-1"> 
              {showAddSubtaskInput && (
                <div className="mb-2 flex gap-2 items-center">
                  <Input 
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    placeholder="New subtask text"
                    className="h-8 flex-grow"
                    aria-label="New subtask input"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtaskSubmit()}
                  />
                  <Button size="sm" onClick={handleAddSubtaskSubmit} className="h-8">Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setNewSubtaskText('');
                    setShowAddSubtaskInput(false);
                  }} className="h-8">Cancel</Button>
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <Accordion type="single" collapsible className="w-full" defaultValue={depth < 1 ? `subtasks-${task.id}`: undefined}>
                  <AccordionItem value={`subtasks-${task.id}`} className="border-b-0">
                    <AccordionTrigger className="text-xs py-1 px-2 rounded-md hover:bg-muted/50 hover:no-underline flex justify-start data-[state=closed]:opacity-70 data-[state=open]:opacity-100">
                      {task.subtasks.length} Subtask(s)
                    </AccordionTrigger>
                    <AccordionContent className="pt-1">
                      {task.subtasks.map(subtask => (
                        <ChecklistItem
                          key={subtask.id}
                          task={subtask}
                          onToggleComplete={onToggleComplete}
                          onDelete={onDelete}
                          onEdit={onEdit}
                          onUpdatePriority={onUpdatePriority}
                          onAddSubtask={onAddSubtask}
                          onGenerateShareLink={onGenerateShareLink}
                          depth={depth + 1}
                          searchTerm={searchTerm}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              
              {hasDetails && (
                 <Accordion type="single" collapsible className="w-full mt-1">
                    <AccordionItem value={`details-${task.id}`} className="border-b-0">
                      <AccordionTrigger className="text-xs py-1 px-2 rounded-md hover:bg-muted/50 hover:no-underline flex justify-start data-[state=closed]:opacity-70 data-[state=open]:opacity-100">
                        <ChevronDown className="h-3 w-3 mr-1 transform transition-transform data-[state=open]:rotate-180" /> Details
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-1 px-2 space-y-3">
                        {task.notes && task.notes.trim() !== '' && (
                          <div>
                            <h4 className="text-xs font-semibold mb-1 flex items-center">
                              <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                              Notes
                            </h4>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-xs p-2 bg-muted/30 rounded-md">
                              <MarkdownWithHighlight markdownText={task.notes} searchTerm={searchTerm} />
                            </div>
                          </div>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-1 flex items-center">
                               <Paperclip className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                               Attachments
                            </h4>
                            <ul className="space-y-1">
                              {task.attachments.map(att => (
                                <li key={att.id} className="flex items-center text-xs">
                                  <LinkIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                  <a 
                                    href={att.value} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-primary hover:underline truncate"
                                    title={att.value}
                                  >
                                    {att.name || getUrlHostname(att.value)}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                 </Accordion>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
