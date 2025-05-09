"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Task, Priority, Attachment, TaskStatus } from '@/lib/types';
import { DEFAULT_TASK_STATUS, TASK_STATUS_OPTIONS } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { XIcon, TagIcon, Flag, FlagOff, LinkIcon, Paperclip, ListChecks } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: Task | null;
  onSave: (
    id: string, 
    newText: string, 
    newTags: string[], 
    newPriority: Priority,
    newNotes: string,
    newAttachments: Attachment[],
    newStatus: TaskStatus // Added newStatus
  ) => void;
}

const priorityConfig: Record<Priority, { label: string; iconClassName: string }> = {
  high: { label: 'High', iconClassName: 'text-red-500' },
  medium: { label: 'Medium', iconClassName: 'text-yellow-500' },
  low: { label: 'Low', iconClassName: 'text-blue-500' },
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

export function EditTaskDialog({ isOpen, onOpenChange, task, onSave }: EditTaskDialogProps) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [currentAttachmentUrlInput, setCurrentAttachmentUrlInput] = useState('');
  const [currentAttachmentNameInput, setCurrentAttachmentNameInput] = useState('');
  const [status, setStatus] = useState<TaskStatus>(DEFAULT_TASK_STATUS); // Added status state

  useEffect(() => {
    if (task) {
      setText(task.text);
      setTags(task.tags || []);
      setPriority(task.priority || 'none');
      setNotes(task.notes || '');
      setAttachments(task.attachments || []);
      setStatus(task.status || DEFAULT_TASK_STATUS); // Initialize status
      setCurrentTagInput('');
      setCurrentAttachmentUrlInput('');
      setCurrentAttachmentNameInput('');
    }
  }, [task]);

  const handleSave = () => {
    if (task) {
      onSave(task.id, text, tags, priority, notes, attachments, status); // Pass status to onSave
      onOpenChange(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = currentTagInput.trim().toLowerCase(); 
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setCurrentTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddAttachment = () => {
    const url = currentAttachmentUrlInput.trim();
    if (!url) return; 

    let name = currentAttachmentNameInput.trim();
    if (!name) {
      name = getUrlHostname(url); 
    }
    
    try {
      new URL(url);
    } catch (_) {
      alert("Invalid URL. Please enter a valid URL starting with http:// or https://");
      return;
    }

    const newAttachment: Attachment = {
      id: crypto.randomUUID(),
      name,
      type: 'url',
      value: url,
      createdAt: Date.now(),
    };
    setAttachments([...attachments, newAttachment]);
    setCurrentAttachmentUrlInput('');
    setCurrentAttachmentNameInput('');
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments(attachments.filter(att => att.id !== attachmentId));
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task details below.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
        <div className="grid gap-6 py-4">
          {/* Task Text */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="edit-task-text" className="text-right pt-2 col-span-1">
              Text
            </Label>
            <Textarea
              id="edit-task-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="col-span-3"
              rows={3}
              placeholder="Your task description (Markdown supported)"
            />
          </div>

          {/* Status */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-task-status" className="text-right col-span-1">
              Status
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center">
                       <ListChecks className="h-4 w-4 mr-2 text-muted-foreground" /> {/* Placeholder icon */}
                      {s}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-task-priority" className="text-right col-span-1">
              Priority
            </Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Set priority" />
              </SelectTrigger>
              <SelectContent>
                {(['none', 'low', 'medium', 'high'] as Priority[]).map(p => (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center">
                      {p === 'none' ? (
                        <FlagOff className={`h-4 w-4 mr-2 ${priorityConfig[p].iconClassName}`} />
                      ) : (
                        <Flag className={`h-4 w-4 mr-2 ${priorityConfig[p].iconClassName}`} />
                      )}
                      {priorityConfig[p].label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="edit-task-tags" className="text-right pt-2 col-span-1">
              Tags
            </Label>
            <div className="col-span-3 space-y-2">
              <Input
                id="edit-task-tags"
                value={currentTagInput}
                onChange={(e) => setCurrentTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter or comma"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="flex items-center">
                      <TagIcon className="h-3 w-3 mr-1" />
                      {tag}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 rounded-full"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="edit-task-notes" className="text-right pt-2 col-span-1">
              Notes
            </Label>
            <Textarea
              id="edit-task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3"
              rows={5}
              placeholder="Add any notes for this task (Markdown supported)"
            />
          </div>

          {/* Attachments */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2 col-span-1">
              Attachments
            </Label>
            <div className="col-span-3 space-y-3">
              <div className="space-y-2">
                <Input
                  value={currentAttachmentNameInput}
                  onChange={(e) => setCurrentAttachmentNameInput(e.target.value)}
                  placeholder="Attachment name (optional)"
                  aria-label="Attachment name input"
                />
                <div className="flex gap-2">
                  <Input
                    value={currentAttachmentUrlInput}
                    onChange={(e) => setCurrentAttachmentUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    aria-label="Attachment URL input"
                    className="flex-grow"
                  />
                  <Button type="button" onClick={handleAddAttachment} variant="outline" size="sm">
                    <LinkIcon className="h-4 w-4 mr-1" /> Add URL
                  </Button>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Attached items:</p>
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md text-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a 
                          href={att.value} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="truncate hover:underline"
                          title={att.value}
                        >
                          {att.name || getUrlHostname(att.value)}
                        </a>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full"
                        onClick={() => removeAttachment(att.id)}
                        aria-label={`Remove attachment ${att.name || att.value}`}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave}>Save Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
