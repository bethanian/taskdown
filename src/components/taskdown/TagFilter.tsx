"use client";

import React from 'react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TagIcon } from 'lucide-react';

interface TagFilterProps {
  tasks: Task[];
  activeFilters: string[];
  setActiveFilters: (filters: string[]) => void;
}

export function TagFilter({ tasks, activeFilters, setActiveFilters }: TagFilterProps) {
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(task => task.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tasks]);

  const toggleFilter = (tag: string) => {
    setActiveFilters(
      activeFilters.includes(tag)
        ? activeFilters.filter(f => f !== tag)
        : [...activeFilters, tag]
    );
  };

  if (allTags.length === 0) {
    return <p className="text-sm text-muted-foreground">No tags available for filtering.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allTags.map(tag => (
        <Button
          key={tag}
          variant={activeFilters.includes(tag) ? "default" : "outline"}
          size="sm"
          onClick={() => toggleFilter(tag)}
          className="transition-all duration-150 ease-in-out"
        >
          <TagIcon className="h-3 w-3 mr-1.5" />
          {tag}
        </Button>
      ))}
      {activeFilters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveFilters([])}
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}
