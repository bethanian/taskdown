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
import type { Task, Priority } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { XIcon, TagIcon, Flag, FlagOff } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: Task | null;
  onSave: (id: string, newText: string, newTags: string[], newPriority: Priority) => void;
}

const priorityConfig: Record<Priority, { label: string; iconClassName: string }> = {
  high: { label: 'High', iconClassName: 'text-red-500' },
  medium: { label: 'Medium', iconClassName: 'text-yellow-500' },
  low: { label: 'Low', iconClassName: 'text-blue-500' },
  none: { label: 'No Priority', iconClassName: 'text-muted-foreground' },
};

export function EditTaskDialog({ isOpen, onOpenChange, task, onSave }: EditTaskDialogProps) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [priority, setPriority] = useState<Priority>('none');

  useEffect(() => {
    if (task) {
      setText(task.text);
      setTags(task.tags || []);
      setPriority(task.priority || 'none');
    }
  }, [task]);

  const handleSave = () => {
    if (task) {
      onSave(task.id, text, tags, priority);
      onOpenChange(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = currentTagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setCurrentTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="task-text" className="text-right pt-2">
              Text
            </Label>
            <Textarea
              id="task-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="col-span-3"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="task-priority" className="text-right">
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
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="task-tags" className="text-right pt-2">
              Tags
            </Label>
            <div className="col-span-3 space-y-2">
              <Input
                id="task-tags"
                value={currentTagInput}
                onChange={(e) => setCurrentTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter"
              />
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center">
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1"
                      onClick={() => removeTag(tag)}
                    >
                      <XIcon className="h-3 w-3" />
                       <span className="sr-only">Remove tag {tag}</span>
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
