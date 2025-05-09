"use client";

import React from 'react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; // Badge can be used for styling if needed, but Button is primary interactive element
import { TagIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  tasks: Task[];
  activeFilters: string[];
  setActiveFilters: (filters: string[]) => void;
}

export function TagFilter({ tasks, activeFilters, setActiveFilters }: TagFilterProps) {
  const getAllTagsRecursive = (taskList: Task[]): string[] => {
    let tags: string[] = [];
    taskList.forEach(task => {
      tags.push(...(task.tags || []).map(t => t.toLowerCase()));
      if (task.subtasks && task.subtasks.length > 0) {
        tags.push(...getAllTagsRecursive(task.subtasks));
      }
    });
    return tags;
  };
  
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>(getAllTagsRecursive(tasks));
    return Array.from(tagSet).sort();
  }, [tasks]);

  const toggleFilter = (tag: string) => {
    const lowerTag = tag.toLowerCase();
    setActiveFilters(
      activeFilters.includes(lowerTag)
        ? activeFilters.filter(f => f !== lowerTag)
        : [...activeFilters, lowerTag]
    );
  };

  if (allTags.length === 0) {
    return <p className="text-sm text-muted-foreground">No tags available for filtering.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allTags.map(tag => (
          <Button
            key={tag}
            variant={activeFilters.includes(tag.toLowerCase()) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFilter(tag)}
            className={cn(
              "transition-all duration-150 ease-in-out",
              activeFilters.includes(tag.toLowerCase()) && "ring-2 ring-primary ring-offset-2"
            )}
            aria-pressed={activeFilters.includes(tag.toLowerCase())}
          >
            <TagIcon className="h-3 w-3 mr-1.5" />
            {tag}
          </Button>
        ))}
      </div>
      {activeFilters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveFilters([])}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
