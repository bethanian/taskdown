export type Priority = 'high' | 'medium' | 'low' | 'none';
export const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low', 'none'];


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

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export const DEFAULT_RECURRENCE_RULE: RecurrenceRule = 'none';
export const RECURRENCE_OPTIONS: RecurrenceRule[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  none: 'None',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};


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
  recurrence: RecurrenceRule; // Added recurrence field
  dependentOnId?: string | null; // ID of the task this task depends on
  dependentOnTaskName?: string; // Name of the task this task depends on (for UI display)
  isBlocked?: boolean; // True if this task is blocked by an incomplete dependency
  user_id?: string | null; // Foreign key to auth.users.id
}

export type Tag = string;

// Types for Filtering and Sorting
export interface TaskFilters {
  dueDateStart?: Date | null;
  dueDateEnd?: Date | null;
  priorities: Priority[];
  assignee?: string;
  statuses: TaskStatus[];
}

export type SortableTaskFields = 'dueDate' | 'priority' | 'createdAt' | 'title' | 'status';

export interface TaskSort {
  field: SortableTaskFields;
  direction: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: TaskFilters = {
  priorities: [],
  statuses: [],
  assignee: '',
  dueDateStart: null,
  dueDateEnd: null,
};

export const DEFAULT_SORT: TaskSort = {
  field: 'createdAt',
  direction: 'desc',
};

export const SORTABLE_FIELD_OPTIONS: Array<{ value: SortableTaskFields; label: string }> = [
  { value: 'createdAt', label: 'Creation Date' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'priority', label: 'Priority (Alphabetical)' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status (Alphabetical)' },
];

// Gamification Types
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType; // Lucide icon component
  criteriaDescription: string; // User-friendly description of how to earn it
  checkCriteria: (rewards: UserRewards, task?: Task) => boolean;
}

export interface EarnedBadge {
  id: string; // Corresponds to BadgeDefinition id
  dateAchieved: number; // Timestamp
}

export interface UserRewards {
  user_id: string;
  points: number;
  current_streak: number;
  last_activity_date: string | null; // ISO date string (YYYY-MM-DD)
  badges_earned: EarnedBadge[];
  total_tasks_completed: number;
}

export const DEFAULT_USER_REWARDS: Omit<UserRewards, 'user_id'> = {
  points: 0,
  current_streak: 0,
  last_activity_date: null,
  badges_earned: [],
  total_tasks_completed: 0,
};