"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import type { useTasks } from '@/hooks/useTasks';

interface NewTaskFormProps {
  addTask: ReturnType<typeof useTasks>['addTask'];
}

export function NewTaskForm({ addTask }: NewTaskFormProps) {
  const [taskText, setTaskText] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (taskText.trim()) {
      addTask(taskText);
      setTaskText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <Input
        type="text"
        value={taskText}
        onChange={(e) => setTaskText(e.target.value)}
        placeholder="Add a new task... (markdown supported)"
        className="flex-grow"
        aria-label="New task input"
      />
      <Button type="submit" size="icon" aria-label="Add task">
        <PlusCircle className="h-5 w-5" />
      </Button>
    </form>
  );
}
