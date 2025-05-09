export type Priority = 'high' | 'medium' | 'low' | 'none';

export interface Task {
  id: string;
  text: string; // User-entered text, potentially with markdown
  completed: boolean;
  tags: string[]; // Array of tag strings
  priority: Priority;
  createdAt: number; // Store as timestamp for easier localForage storage
  updatedAt: number; // Store as timestamp
  subtasks?: Task[]; // Optional array for nested subtasks
}

export type Tag = string;
