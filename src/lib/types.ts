export type Priority = 'high' | 'medium' | 'low' | 'none';

export interface Attachment {
  id: string;
  name: string; // User-defined name or filename from URL
  type: 'url' | 'file'; // Initially focusing on 'url'
  value: string; // URL string
  createdAt: number;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Done';
export const DEFAULT_TASK_STATUS: TaskStatus = 'To Do';
export const TASK_STATUS_OPTIONS: TaskStatus[] = ['To Do', 'In Progress', 'Blocked', 'Done'];

export interface Task {
  id: string;
  text: string; // User-entered text, potentially with markdown
  completed: boolean;
  tags: string[]; // Array of tag strings
  priority: Priority;
  status: TaskStatus; // Ensure all tasks have a status
  createdAt: number; // Store as timestamp for easier localForage storage
  updateAt: number; // Store as timestamp
  dueDate?: number; // Optional: due date as a timestamp
  subtasks?: Task[]; // Optional array for nested subtasks
  notes?: string; // Optional multiline text notes
  attachments?: Attachment[]; // Optional array of attachments
  assignedTo?: string; // Optional: name or ID of the person the task is assigned to
  shareId?: string; // Optional: unique ID for generating a shareable link
}

export type Tag = string;

