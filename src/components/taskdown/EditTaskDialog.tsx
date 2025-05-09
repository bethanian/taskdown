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
import type { Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { XIcon, TagIcon } from 'lucide-react';

interface EditTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: Task | null;
  onSave: (id: string, newText: string, newTags: string[]) => void;
}

export function EditTaskDialog({ isOpen, onOpenChange, task, onSave }: EditTaskDialogProps) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTagInput, setCurrentTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setText(task.text);
      setTags(task.tags || []);
    }
  }, [task]);

  const handleSave = () => {
    if (task) {
      onSave(task.id, text, tags);
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="task-text" className="text-right">
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
            <Label htmlFor="task-tags" className="text-right">
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
