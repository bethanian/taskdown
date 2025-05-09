"use client";

import { cn } from '@/lib/utils';
import { MarkdownWithHighlight } from './MarkdownWithHighlight';

interface ChecklistItemContentProps {
  text: string;
  completed: boolean;
  searchTerm?: string; // Added searchTerm prop
}

export function ChecklistItemContent({ text, completed, searchTerm }: ChecklistItemContentProps) {
  return (
    <div 
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words [&>p]:my-0",
        completed && "line-through text-muted-foreground"
      )}
    >
      <MarkdownWithHighlight markdownText={text} searchTerm={searchTerm} />
    </div>
  );
}