"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Eye, Code } from 'lucide-react';
import type { useTasks } from '@/hooks/useTasks';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NewTaskFormProps {
  addTask: ReturnType<typeof useTasks>['addTask'];
}

export function NewTaskForm({ addTask }: NewTaskFormProps) {
  const [taskText, setTaskText] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (taskText.trim()) {
      addTask(taskText);
      setTaskText('');
      setShowPreview(false); // Reset to input mode after adding
    }
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-start">
        {showPreview ? (
          <div 
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none break-words flex-grow p-2 min-h-[2.5rem] border rounded-md bg-muted/50",
              taskText.trim() === "" && "text-muted-foreground italic" 
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {taskText.trim() === "" ? "Nothing to preview yet..." : taskText}
            </ReactMarkdown>
          </div>
        ) : (
          <Input
            type="text"
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            placeholder="Add a new task... (markdown supported)"
            className="flex-grow"
            aria-label="New task input"
          />
        )}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                onClick={togglePreview} 
                aria-pressed={showPreview}
                aria-label={showPreview ? "Switch to Markdown input" : "Switch to preview"}
              >
                {showPreview ? <Code className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{showPreview ? "Edit Markdown" : "Preview Markdown"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" size="icon" aria-label="Add task">
                <PlusCircle className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add task</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </form>
  );
}
