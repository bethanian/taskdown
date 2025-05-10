
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UserRewards, EarnedBadge, Task } from '@/lib/types';
import { DEFAULT_USER_REWARDS } from '@/lib/types';
import { BADGE_DEFINITIONS, getBadgeDefinitionById } from '@/lib/rewards';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInCalendarDays, parseISO, isValid } from 'date-fns';

const POINTS_PER_TASK = 10;

export function useUserRewards() {
  const [userRewards, setUserRewards] = useState<UserRewards | null>(null);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      } else {
        setCurrentUserId(null);
        setIsLoadingRewards(false); // No user, no rewards to load
      }
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setCurrentUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setUserRewards(null);
        setIsLoadingRewards(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUserRewards = useCallback(async (userId: string) => {
    setIsLoadingRewards(true);
    const { data, error } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: " वैद्य" (row not found)
      console.error('Error fetching user rewards:', error);
      toast({ title: 'Error', description: 'Could not load your rewards.', variant: 'destructive' });
      setUserRewards(null);
    } else if (data) {
      setUserRewards(data as UserRewards);
    } else {
      // No row found, create one for the user
      const defaultRewardsForUser: UserRewards = {
        ...DEFAULT_USER_REWARDS,
        user_id: userId,
      };
      const { data: newReward, error: insertError } = await supabase
        .from('user_rewards')
        .insert(defaultRewardsForUser)
        .select()
        .single();
      if (insertError) {
        console.error('Error creating initial user rewards:', insertError);
        toast({ title: 'Error', description: 'Could not initialize your rewards.', variant: 'destructive' });
        setUserRewards(null);
      } else {
        setUserRewards(newReward as UserRewards);
      }
    }
    setIsLoadingRewards(false);
  }, [toast]);

  useEffect(() => {
    if (currentUserId) {
      fetchUserRewards(currentUserId);
    }
  }, [currentUserId, fetchUserRewards]);

  const handleTaskCompletion = useCallback(async (task: Task) => {
    if (!currentUserId) return;

    let currentRewards = userRewards;
    if (!currentRewards) {
      // Attempt to fetch again if null, though should be initialized
      const { data, error } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', currentUserId)
        .single();
      if (error || !data) {
         console.error('Cannot update rewards, current rewards data missing for user:', currentUserId);
         toast({ title: "Error", description: "Could not update rewards data.", variant: "destructive"});
         return;
      }
      currentRewards = data as UserRewards;
    }
    
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    let newPoints = currentRewards.points + POINTS_PER_TASK;
    let newStreak = currentRewards.current_streak;
    let newLastActivityDate = currentRewards.last_activity_date;
    let newTotalTasksCompleted = currentRewards.total_tasks_completed + 1;

    if (newLastActivityDate) {
      const lastActivity = parseISO(newLastActivityDate);
      if (isValid(lastActivity)) {
        const diffDays = differenceInCalendarDays(today, lastActivity);
        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1; // Streak broken
        }
        // If diffDays is 0, streak remains the same for multiple completions on the same day
      } else { // Invalid last activity date
        newStreak = 1;
      }
    } else { // First activity
      newStreak = 1;
    }
    newLastActivityDate = todayStr;

    const newlyEarnedBadges: EarnedBadge[] = [];
    BADGE_DEFINITIONS.forEach(badgeDef => {
      const alreadyEarned = currentRewards.badges_earned.some(eb => eb.id === badgeDef.id);
      if (!alreadyEarned) {
        const tempRewardsForCheck: UserRewards = { // Create a temporary state for checking
          ...currentRewards,
          points: newPoints,
          current_streak: newStreak,
          total_tasks_completed: newTotalTasksCompleted,
        };
        if (badgeDef.checkCriteria(tempRewardsForCheck, task)) {
          const newBadge: EarnedBadge = { id: badgeDef.id, dateAchieved: Date.now() };
          newlyEarnedBadges.push(newBadge);
          toast({
            title: 'Badge Unlocked!',
            description: `You've earned the "${badgeDef.name}" badge!`,
            duration: 5000,
          });
        }
      }
    });
    
    const updatedRewardsPayload: Partial<UserRewards> = {
      points: newPoints,
      current_streak: newStreak,
      last_activity_date: newLastActivityDate,
      badges_earned: [...currentRewards.badges_earned, ...newlyEarnedBadges],
      total_tasks_completed: newTotalTasksCompleted,
    };

    const { data: updatedData, error: updateError } = await supabase
      .from('user_rewards')
      .update(updatedRewardsPayload)
      .eq('user_id', currentUserId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user rewards:', updateError);
      toast({ title: 'Error', description: 'Failed to save your reward progress.', variant: 'destructive' });
    } else if (updatedData) {
      setUserRewards(updatedData as UserRewards); // Update local state
    }
  }, [currentUserId, userRewards, toast]);

  return { userRewards, isLoadingRewards, handleTaskCompletion, fetchUserRewards };
}