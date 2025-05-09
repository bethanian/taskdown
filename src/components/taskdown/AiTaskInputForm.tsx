"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProcessTaskInput, ProcessTaskOutput } from '@/ai/flows/process-task-input-flow';

interface AiTaskInputFormProps {
  onProcessTasks: (input: ProcessTaskInput) => Promise<ProcessTaskOutput | null>;
  disabled?: boolean;
}

export function AiTaskInputForm({ onProcessTasks, disabled }: AiTaskInputFormProps) {
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!aiInput.trim()) {
      toast({ title: "Info", description: "Please enter instructions for the AI." });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await onProcessTasks({ naturalLanguageInput: aiInput });
      if (result) {
        // Success toast will be handled by useTasks after applying changes
        setAiInput(''); // Clear input on success
      } else {
        // This case might be hit if onProcessTasks itself returns null due to an issue before calling the AI
        toast({
          title: "AI Processing Error",
          description: "Could not process your request. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI task processing error:", error);
      toast({
        title: "AI Task Error",
        description: "An error occurred while communicating with the AI. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder="E.g., 'Add: Project X with subtasks: A, B. Remove: Old meeting'"
          className="flex-grow"
          aria-label="AI task input"
          disabled={isProcessing || disabled}
        />
        <Button type="submit" disabled={isProcessing || disabled || !aiInput.trim()} aria-label="Process with AI">
          <Sparkles className={`h-5 w-5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span className="ml-2 hidden sm:inline">{isProcessing ? 'Processing...' : 'AI Process'}</span>
        </Button>
      </div>
    </form>
  );
}
