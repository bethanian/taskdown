export type Priority = 'high' | 'medium' | 'low' | 'none';

export interface Attachment {
  id: string;
  name: string; // User-defined name or filename from URL
  type: 'url' | 'file'; // Initially focusing on 'url'
  value: string; // URL string
  createdAt: number;
}

export interface Task {
  id: string;
  text: string; // User-entered text, potentially with markdown
  completed: boolean;
  tags: string[]; // Array of tag strings
  priority: Priority;
  createdAt: number; // Store as timestamp for easier localForage storage
  updatedAt: number; // Store as timestamp
  subtasks?: Task[]; // Optional array for nested subtasks
  notes?: string; // Optional multiline text notes
  attachments?: Attachment[]; // Optional array of attachments
}

export type Tag = string;

