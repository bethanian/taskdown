"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Task, Attachment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TagIcon, FlagIcon, CalendarDays, User, Paperclip, LinkIcon, CheckCircle, Circle, ListChecks, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format, isPast, isToday, differenceInCalendarDays } from 'date-fns';
import { Header } from '@/components/taskdown/Header';
import { MarkdownWithHighlight } from '@/components/taskdown/MarkdownWithHighlight';
import { supabase } from '@/lib/supabaseClient';
import { DEFAULT_TASK_STATUS } from '@/lib/types';

const priorityConfigDisplay: Record<Task['priority'], { label: string; iconClassName: string; badgeVariant?: "default" | "secondary" | "destructive" | "outline" }> = {
  high: { label: 'High', iconClassName: 'text-red-500', badgeVariant: 'destructive' },
  medium: { label: 'Medium', iconClassName: 'text-yellow-500', badgeVariant: 'secondary' },
  low: { label: 'Low', iconClassName: 'text-blue-500', badgeVariant: 'default' },
  none: { label: 'None', iconClassName: 'text-muted-foreground', badgeVariant: 'outline' },
};

function getUrlHostname(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (e) {
    return url;
  }
}

function SharedTaskDueDate({ dueDateTimestamp, completed }: { dueDateTimestamp?: number; completed?: boolean }) {
  if (!dueDateTimestamp) return null;
  const dueDateObj = new Date(dueDateTimestamp);
  let text = format(dueDateObj, "PPP");
  let className = "text-muted-foreground";
  let tooltip = `Due: ${text}`;

  if (completed) {
    className = "text-green-600";
    tooltip = `Completed, Due: ${text}`;
  } else if (isPast(dueDateObj) && !isToday(dueDateObj)) {
    className = "text-red-500 font-semibold";
    tooltip = `Overdue: ${text}`;
  } else if (isToday(dueDateObj)) {
    className = "text-orange-500 font-semibold";
    tooltip = `Due Today: ${text}`;
  } else {
    const diffDays = differenceInCalendarDays(dueDateObj, new Date());
    if (diffDays === 1) {
      className = "text-yellow-600";
      tooltip = `Due Tomorrow: ${text}`;
    } else if (diffDays > 1 && diffDays <= 7) {
      className = "text-blue-600";
      tooltip = `Due in ${diffDays} days: ${text}`;
    }
  }
  return (
    <div className="flex items-center text-sm" title={tooltip}>
      <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
      <span className={className}>{text}</span>
    </div>
  );
}

function SharedTaskDisplay({ task }: { task: Task }) {
  const priorityInfo = priorityConfigDisplay[task.priority || 'none'];
  
  const calculateProgress = (tasks: Task[]): { completed: number; total: number; percentage: number } => {
    let total = 0;
    let completed = 0;
    const count = (taskList: Task[]) => {
      for (const t of taskList) {
        total++;
        if (t.completed) completed++;
        if (t.subtasks) count(t.subtasks);
      }
    };
    if (task.subtasks) count(task.subtasks);
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };
  const subtaskProgress = task.subtasks && task.subtasks.length > 0 ? calculateProgress(task.subtasks) : null;

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Link href="/" passHref>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </Button>
          </Link>
          {task.completed ? (
            <Badge variant="default" className="bg-green-500 text-white">
              <CheckCircle className="h-4 w-4 mr-2" /> Completed
            </Badge>
          ) : (
             <Badge variant="secondary">
              <Circle className="h-4 w-4 mr-2" /> {task.status || 'To Do'}
            </Badge>
          )}
        </div>
        <CardTitle className="text-2xl font-bold break-words">{task.text}</CardTitle>
        <CardDescription>
          Task details (shared view)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {task.dueDate && (
            <SharedTaskDueDate dueDateTimestamp={task.dueDate} completed={task.completed} />
          )}
          {task.assignedTo && (
            <div className="flex items-center text-sm">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Assigned to: <strong>{task.assignedTo}</strong></span>
            </div>
          )}
        </div>
        
        {(task.tags && task.tags.length > 0 || task.priority !== 'none') && <Separator />}

        <div className="flex flex-wrap items-center gap-3">
          {task.priority !== 'none' && (
            <Badge variant={priorityInfo.badgeVariant || 'outline'} className="text-sm py-1 px-2">
              <FlagIcon className={`h-4 w-4 mr-2 ${priorityInfo.iconClassName}`} />
              Priority: {priorityInfo.label}
            </Badge>
          )}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <TagIcon className="h-4 w-4 text-muted-foreground" />
              {task.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-sm">{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        {task.notes && (
          <>
            <Separator />
            <div>
              <h3 className="text-md font-semibold mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" /> Notes
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/30 rounded-md">
                <MarkdownWithHighlight markdownText={task.notes} searchTerm="" /> 
              </div>
            </div>
          </>
        )}

        {task.attachments && task.attachments.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-md font-semibold mb-2 flex items-center">
                <Paperclip className="h-4 w-4 mr-2 text-muted-foreground" /> Attachments
              </h3>
              <ul className="space-y-2">
                {task.attachments.map((att: Attachment) => (
                  <li key={att.id} className="text-sm">
                    <a
                      href={att.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-primary hover:underline"
                    >
                      <LinkIcon className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate" title={att.value}>{att.name || getUrlHostname(att.value)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {task.subtasks && task.subtasks.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-md font-semibold mb-2 flex items-center">
                <ListChecks className="h-4 w-4 mr-2 text-muted-foreground" /> Subtasks 
                {subtaskProgress && ` (${subtaskProgress.completed}/${subtaskProgress.total} done)`}
              </h3>
              {subtaskProgress && (
                <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                  <div 
                    className="bg-primary h-1.5 rounded-full" 
                    style={{ width: `${subtaskProgress.percentage}%`}}
                  ></div>
                </div>
              )}
              <ul className="space-y-3 pl-2">
                {task.subtasks.map(subtask => (
                  <li key={subtask.id} className="text-sm flex items-start">
                    {subtask.completed ? (
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground shrink-0" />
                    )}
                    <div className={subtask.completed ? 'line-through text-muted-foreground' : ''}>
                      <span className="font-medium">{subtask.text}</span>
                       {subtask.tags && subtask.tags.length > 0 && subtask.tags.map(st => ` #${st}`).join(' ')}
                       {subtask.assignedTo && ` (@${subtask.assignedTo})`}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShareTaskPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const [sharedTask, setSharedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedTask() {
      if (!shareId) {
        setError("Share ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: dbError } = await supabase
          .from('tasks')
          .select('*, subtasks:tasks!parent_id(*)') 
          .eq('share_id', shareId)
          .single();

        if (dbError || !data) {
          console.error("Supabase fetch error or no data:", dbError);
          setError(`Task with share ID "${shareId}" not found or error loading task.`);
          setLoading(false);
          return; // Stop if Supabase fails or returns no data
        }

        // Map Supabase data (including subtasks if joined correctly) to TaskType
        const mapSupabaseRowToTaskType = (row: any): Task => ({
          id: row.id,
          text: row.title,
          completed: row.completed,
          tags: row.tags || [],
          priority: row.priority || 'none',
          status: row.status || DEFAULT_TASK_STATUS, // Use imported DEFAULT_TASK_STATUS
          createdAt: new Date(row.created_at).getTime(),
          updateAt: new Date(row.updated_at).getTime(),
          dueDate: row.due_date ? new Date(row.due_date).getTime() : undefined,
          notes: row.notes || '',
          attachments: row.attachments || [],
          assignedTo: row.assigned_to || undefined,
          shareId: row.share_id || undefined,
          subtasks: row.subtasks ? row.subtasks.map(mapSupabaseRowToTaskType) : [], // Recursive mapping for subtasks
        });

        setSharedTask(mapSupabaseRowToTaskType(data));
       
      } catch (err: any) {
        console.error("General error fetching shared task:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedTask();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center flex-grow">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Loading shared task...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Header />
        <main className="flex flex-col items-center justify-center flex-grow px-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="bg-destructive text-destructive-foreground p-6">
                    <CardTitle className="text-2xl">Error Loading Task</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Link href="/" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Go to Homepage
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </main>
      </div>
    );
  }

  if (!sharedTask) {
    // This case should ideally be covered by the error state if Supabase fetch fails
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
          <Header />
          <main className="flex flex-col items-center justify-center flex-grow px-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="bg-destructive text-destructive-foreground p-6">
                    <CardTitle className="text-2xl">Task Not Found</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-6">
                        The task you are looking for could not be found or is no longer available for sharing.
                    </p>
                    <Link href="/" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Go to Homepage
                        </Button>
                    </Link>
                </CardContent>
            </Card>
          </main>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <Header />
      <main className="container mx-auto py-8 px-4">
        <SharedTaskDisplay task={sharedTask} />
      </main>
    </div>
  );
} 