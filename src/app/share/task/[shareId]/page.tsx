"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
// import { useTasks } from '@/hooks/useTasks'; // We will fetch directly for shared tasks
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
import { LOCALSTORAGE_TASKS_KEY } from '@/lib/constants'; // For temporary local check
import localforage from 'localforage'; // For temporary local check

// Helper to find a task by shareId recursively
// This helper would ideally not be needed here if backend fetches specific task
const findTaskByShareIdRecursive = (
  tasksToSearch: Task[],
  shareIdToFind: string
): Task | null => {
  for (const task of tasksToSearch) {
    if (task.shareId === shareIdToFind) {
      return task;
    }
    if (task.subtasks && task.subtasks.length > 0) {
      const foundInSubtasks = findTaskByShareIdRecursive(task.subtasks, shareIdToFind);
      if (foundInSubtasks) {
        return foundInSubtasks;
      }
    }
  }
  return null;
};

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
    if (!shareId) {
        setLoading(false);
        setError("Invalid share link: No Share ID provided.");
        return;
    }
    
    setLoading(true);
    setError(null);

    async function fetchSharedTask() {
      try {
        // THIS IS A TEMPORARY LOCAL CHECK AND WILL NOT WORK FOR OTHER USERS.
        // Replace this with a backend API call to fetch the task by shareId.
        console.log(`Attempting to find task with shareId: ${shareId} locally.`);
        const allTasks = await localforage.getItem<Task[]>(LOCALSTORAGE_TASKS_KEY);

        if (allTasks) {
          const foundTask = findTaskByShareIdRecursive(allTasks, shareId);
          if (foundTask) {
            setSharedTask(foundTask);
          } else {
            setError(
              "Shared task not found. This link may be invalid, the task may have been deleted, or it's not accessible to you."
            );
          }
        } else {
          setError("No tasks found in your local storage. Cannot verify shared link.");
        }
      } catch (e: any) {
        console.error("Error fetching shared task (locally):", e);
        setError(e.message || "An error occurred while trying to load the shared task.");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedTask();
  }, [shareId]);

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow mt-8">
        {loading && (
          <div className="text-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Loading shared task...</p>
          </div>
        )}
        {error && (
          <Card className="w-full max-w-lg mx-auto bg-destructive/10 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive text-xl">Error Loading Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-destructive-foreground text-sm">{error}</p>
              <Button asChild variant="ghost" className="text-destructive-foreground hover:bg-destructive/20">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Go to Homepage
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {!loading && !error && sharedTask && (
          <SharedTaskDisplay task={sharedTask} />
        )}
        {!loading && !error && !sharedTask && (
           // This state might be briefly visible if localforage is empty and then error is set.
           // The error message for 'foundTask' being null covers this better.
           <Card className="w-full max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="text-xl">Task Not Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                The shared task could not be loaded. It might have been deleted or the link is incorrect.
              </p>
              <Button asChild variant="link" className="px-0">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Go to Homepage
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
       <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Taskdown. Shared Task View.</p>
      </footer>
    </div>
  );
} 