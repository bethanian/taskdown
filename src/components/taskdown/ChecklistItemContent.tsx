"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ChecklistItemContentProps {
  text: string;
  completed: boolean;
}

export function ChecklistItemContent({ text, completed }: ChecklistItemContentProps) {
  return (
    <div 
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words",
        completed && "line-through text-muted-foreground"
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
