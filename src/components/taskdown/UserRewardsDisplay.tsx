
"use client";

import React from 'react';
import type { UserRewards } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeDisplayItem } from './BadgeDisplayItem';
import { Gem, Flame, Trophy } from 'lucide-react';

interface UserRewardsDisplayProps {
  rewards: UserRewards | null;
  isLoading: boolean;
}

export function UserRewardsDisplay({ rewards, isLoading }: UserRewardsDisplayProps) {
  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary flex items-center">
            <Trophy className="mr-2 h-5 w-5" /> Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-around items-center text-center">
            <div>
              <Skeleton className="h-6 w-16 mb-1" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div>
              <Skeleton className="h-6 w-16 mb-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
          <div>
            <Skeleton className="h-5 w-24 mb-2" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-28 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rewards) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary flex items-center">
            <Trophy className="mr-2 h-5 w-5" /> Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No reward data available. Complete tasks to earn points and badges!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-bold text-primary flex items-center">
          <Trophy className="mr-3 h-7 w-7 animate-pulse" /> Your Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-primary/10 rounded-lg shadow">
            <div className="flex items-center justify-center text-primary mb-1">
              <Gem className="h-6 w-6 mr-2" />
              <span className="text-3xl font-bold">{rewards.points}</span>
            </div>
            <p className="text-sm text-muted-foreground">Points</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg shadow">
            <div className="flex items-center justify-center text-amber-500 mb-1">
              <Flame className="h-6 w-6 mr-2" />
              <span className="text-3xl font-bold">{rewards.current_streak}</span>
            </div>
            <p className="text-sm text-muted-foreground">Day Streak</p>
          </div>
        </div>

        {rewards.badges_earned.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">Badges Earned ({rewards.badges_earned.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {rewards.badges_earned.map(badge => (
                <BadgeDisplayItem key={badge.id} earnedBadge={badge} />
              ))}
            </div>
          </div>
        )}
         {rewards.badges_earned.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Keep completing tasks to earn badges!</p>
        )}
      </CardContent>
    </Card>
  );
}