
// src/components/taskdown/ChecklistItem.tsx
"use client";

import React, { useState, useEffect } from 'react';
import type { Task, Priority, Attachment, RecurrenceRule } from '@/lib/types';
import { RECURRENCE_LABELS } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Edit3, TagIcon, FlagIcon, FlagOff, Check, Plus, ChevronDown, FileText, LinkIcon, Paperclip, User, Share2, CalendarDays, ListChecks, RefreshCw, AlertTriangle, CalendarPlus } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast";
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { addEventToCalendar, loadGapiClient } from '@/lib/googleCalendarService';

interface ChecklistItemProps {
  task: Task;
  onToggleComplete: (id: string, currentCompletedState: boolean) => void;
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
  const { toast } = useToast();
  const { isSignedIn, accessToken } = useGoogleAuth();
  const [isClient, setIsClient] = useState(false);
  const [isSyncingToCalendar, setIsSyncingToCalendar] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (isSignedIn) {
      loadGapiClient().catch(err => console.error("Failed to preload GAPI client:", err));
    }
  }, [isSignedIn]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: depth > 0 || task.isBlocked }); 

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

  const handleShareLink = async () => {
    const shareUrl = await onGenerateShareLink(task.id);
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied",
          description: "Shareable link copied to clipboard.",
        });
      } catch (err) {
        console.error("Failed to copy link: ", err);
        toast({
          title: "Copy Failed",
          description: "Could not copy link to clipboard. You may need to grant permission or copy manually.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSyncToCalendar = async () => {
    if (!isSignedIn || !accessToken) {
      toast({ title: "Not Connected", description: "Please connect to Google Calendar first.", variant: "destructive" });
      return;
    }
    if (!task.dueDate) {
      toast({ title: "No Due Date", description: "Task needs a due date to be synced to calendar.", variant: "default" });
      return;
    }
    setIsSyncingToCalendar(true);
    try {
      await addEventToCalendar(accessToken, task);
      toast({ title: "Synced to Calendar", description: `"${task.text}" added to your Google Calendar.` });
    } catch (error: any) {
      console.error("Failed to sync task to calendar:", error);
      toast({ title: "Sync Failed", description: error.message || "Could not add task to calendar.", variant: "destructive" });
    } finally {
      setIsSyncingToCalendar(false);
    }
  };
  
  const hasDetails = (task.notes && task.notes.trim() !== '') || (task.attachments && task.attachments.length > 0);
  const isDisabled = task.isBlocked;

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-1 group transition-all duration-200 shadow-sm hover:shadow-md",
          isDragging && "opacity-80 shadow-lg z-50",
          depth > 0 && "bg-card/95",
          isDisabled && "opacity-70 bg-muted/30"
        )}
      >
        <CardContent className="p-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 group">
            {depth === 0 && ( 
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("cursor-grab h-7 w-7 opacity-30 group-hover:opacity-100 transition-opacity shrink-0", isDisabled && "cursor-not-allowed opacity-20")}
                    aria-label="Drag to reorder"
                    disabled={isDisabled}
                    {...(isDisabled ? {} : attributes)} 
                    {...(isDisabled ? {} : listeners)}  
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
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isDisabled}>
                      {task.priority === 'none' || !task.priority ? (
                        <FlagOff className={`h-3.5 w-3.5 ${currentPriorityConfig.iconClassName}`} />
                      ) : (
                        <FlagIcon className={`h-3.5 w-3.5 ${currentPriorityConfig.iconClassName}`} />
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
                    disabled={isDisabled}
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
              onCheckedChange={() => onToggleComplete(task.id, task.completed)}
              aria-label={`Mark task ${task.completed ? 'incomplete' : 'complete'}`}
              className="h-4 w-4 rounded-sm border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              disabled={isDisabled}
            />

            {subtaskProgress !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-12 h-1.5 ml-1.5">
                    <Progress value={subtaskProgress} className="h-1.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Subtask Progress: {subtaskProgress.toFixed(0)}%</p>
                </TooltipContent>
              </Tooltip>
            )}

            <div className="flex-grow min-w-0 flex items-center justify-between">
              <div className="flex-grow min-w-0 flex items-center gap-1">
                <div id={`task-text-${task.id}`} className={cn("cursor-pointer flex-grow min-w-0", isDisabled && "cursor-not-allowed")} onClick={() => !isDisabled && onToggleComplete(task.id, task.completed)}>
                    <ChecklistItemContent text={task.text} completed={task.completed} searchTerm={searchTerm} />
                </div>
                {task.isBlocked && task.dependentOnTaskName && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="destructive" className="text-xs py-0.5 px-1.5 items-center ml-1.5">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Blocked
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent><p>Blocked by: "{task.dependentOnTaskName}"</p></TooltipContent>
                    </Tooltip>
                )}
                <div className="flex flex-wrap shrink-0 gap-0.5 items-center ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                  {isClient && dueDateInfo && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={cn("text-xs py-0.5 px-1.5 items-center", dueDateInfo.className)}>
                          <CalendarDays className="h-2.5 w-2.5 mr-0.5" />
                          {dueDateInfo.text}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p>{dueDateInfo.tooltip}</p></TooltipContent>
                    </Tooltip>
                  )}
                  {task.recurrence && task.recurrence !== 'none' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs py-0.5 px-1.5 items-center text-purple-600 border-purple-600/50">
                           <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                           {RECURRENCE_LABELS[task.recurrence]}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p>Recurs {RECURRENCE_LABELS[task.recurrence].toLowerCase()}</p></TooltipContent>
                    </Tooltip>
                  )}
                  {task.tags && task.tags.length > 0 && task.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs py-0.5 px-1.5">
                      <TagIcon className="h-2.5 w-2.5 mr-0.5" />
                      <HighlightedText text={tag} highlight={searchTerm} />
                    </Badge>
                  ))}
                  {task.assignedTo && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs py-0.5 px-1.5 flex items-center">
                          <User className="h-2.5 w-2.5 mr-0.5 text-muted-foreground" />
                          <HighlightedText text={task.assignedTo} highlight={searchTerm} />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Assigned to: {task.assignedTo}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              <div className="flex items-center shrink-0 gap-0.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                {isSignedIn && task.dueDate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleSyncToCalendar} className="h-7 w-7" disabled={isSyncingToCalendar}>
                        {isSyncingToCalendar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                        <span className="sr-only">Sync to Google Calendar</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sync to Google Calendar</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7">
                      <Edit3 className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit task</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit task</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setShowAddSubtaskInput(prev => !prev)} className="h-7 w-7" disabled={isDisabled}>
                      <Plus className="h-3.5 w-3.5" />
                      <span className="sr-only">Add subtask</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add subtask</TooltipContent>
                </Tooltip>
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleShareLink} className="h-7 w-7">
                      <Share2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Share task</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share task (copy link)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-7 w-7 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete task</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete task</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Subtasks and Details Accordion Area */}
          {(showAddSubtaskInput || (task.subtasks && task.subtasks.length > 0) || hasDetails) && (
            <div className="pl-6 mt-0.5"> 
              {showAddSubtaskInput && (
                <div className="mb-1.5 flex gap-1.5 items-center">
                  <Input 
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    placeholder="New subtask text"
                    className="h-7 flex-grow text-xs"
                    aria-label="New subtask input"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtaskSubmit()}
                    disabled={isDisabled}
                  />
                  <Button size="sm" onClick={handleAddSubtaskSubmit} className="h-7 text-xs px-2" disabled={isDisabled}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setNewSubtaskText('');
                    setShowAddSubtaskInput(false);
                  }} className="h-7 text-xs px-2" disabled={isDisabled}>Cancel</Button>
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <Accordion type="single" collapsible className="w-full" defaultValue={depth < 1 ? `subtasks-${task.id}`: undefined}>
                  <AccordionItem value={`subtasks-${task.id}`} className="border-b-0">
                    <AccordionTrigger className="text-xs py-0.5 px-1.5 rounded hover:bg-muted/50 hover:no-underline flex justify-start data-[state=closed]:opacity-60 data-[state=open]:opacity-100">
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
                 <Accordion type="single" collapsible className="w-full mt-0.5">
                    <AccordionItem value={`details-${task.id}`} className="border-b-0">
                      <AccordionTrigger className="text-xs py-0.5 px-1.5 rounded hover:bg-muted/50 hover:no-underline flex justify-start data-[state=closed]:opacity-60 data-[state=open]:opacity-100">
                        <ChevronDown className="h-3 w-3 mr-1 transform transition-transform data-[state=open]:rotate-180" /> Details
                      </AccordionTrigger>
                      <AccordionContent className="pt-1.5 pb-0.5 px-1.5 space-y-2">
                        {task.notes && task.notes.trim() !== '' && (
                          <div>
                            <h4 className="text-xs font-semibold mb-0.5 flex items-center">
                              <FileText className="h-3 w-3 mr-1 text-muted-foreground" />
                              Notes
                            </h4>
                            <div className="prose prose-xs dark:prose-invert max-w-none text-xs p-1.5 bg-muted/30 rounded">
                              <MarkdownWithHighlight markdownText={task.notes} searchTerm={searchTerm} />
                            </div>
                          </div>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-0.5 flex items-center">
                               <Paperclip className="h-3 w-3 mr-1.5 text-muted-foreground" />
                               Attachments
                            </h4>
                            <ul className="space-y-0.5">
                              {task.attachments.map(att => (
                                <li key={att.id} className="flex items-center text-xs">
                                  <LinkIcon className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
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
