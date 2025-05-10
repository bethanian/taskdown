
import type { BadgeDefinition, UserRewards, Task } from './types';
import { Award, Zap, CalendarCheck, Target, Star, TrendingUp, ShieldCheck } from 'lucide-react';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_task',
    name: 'First Step',
    description: 'You completed your very first task!',
    icon: Award,
    criteriaDescription: 'Complete 1 task.',
    checkCriteria: (rewards) => rewards.total_tasks_completed >= 1,
  },
  {
    id: 'ten_tasks',
    name: 'Task Apprentice',
    description: 'Completed 10 tasks. Keep up the great work!',
    icon: Star,
    criteriaDescription: 'Complete 10 tasks.',
    checkCriteria: (rewards) => rewards.total_tasks_completed >= 10,
  },
  {
    id: 'fifty_tasks',
    name: 'Task Journeyman',
    description: 'Wow, 50 tasks completed! You\'re a productivity machine.',
    icon: Zap,
    criteriaDescription: 'Complete 50 tasks.',
    checkCriteria: (rewards) => rewards.total_tasks_completed >= 50,
  },
  {
    id: 'hundred_tasks',
    name: 'Task Master',
    description: '100 tasks conquered. Impressive dedication!',
    icon: Target,
    criteriaDescription: 'Complete 100 tasks.',
    checkCriteria: (rewards) => rewards.total_tasks_completed >= 100,
  },
  {
    id: 'streak_3_days',
    name: 'On a Roll',
    description: 'Completed tasks for 3 days in a row.',
    icon: TrendingUp,
    criteriaDescription: 'Maintain a 3-day streak.',
    checkCriteria: (rewards) => rewards.current_streak >= 3,
  },
  {
    id: 'streak_7_days',
    name: 'Week Warrior',
    description: 'A full week of consistent task completion!',
    icon: CalendarCheck,
    criteriaDescription: 'Maintain a 7-day streak.',
    checkCriteria: (rewards) => rewards.current_streak >= 7,
  },
  {
    id: 'high_priority_slayer',
    name: 'Priority Smasher',
    description: 'Completed a high-priority task.',
    icon: ShieldCheck,
    criteriaDescription: 'Complete a task with "high" priority.',
    checkCriteria: (rewards, task) => task?.priority === 'high',
  },
  // Add more badge definitions here
];

export const getBadgeDefinitionById = (id: string): BadgeDefinition | undefined => {
  return BADGE_DEFINITIONS.find(b => b.id === id);
};