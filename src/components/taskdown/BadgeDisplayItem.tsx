"use client";

import React from 'react';
import type { EarnedBadge } from '@/lib/types';
import { getBadgeDefinitionById } from '@/lib/rewards';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BadgeDisplayItemProps {
  earnedBadge: EarnedBadge;
  className?: string;
}

export function BadgeDisplayItem({ earnedBadge, className }: BadgeDisplayItemProps) {
  const definition = getBadgeDefinitionById(earnedBadge.id);

  if (!definition) {
    const unknownBadgeDisplay = (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("p-2 cursor-help", className)}>
              <span className="text-xs text-muted-foreground">Unknown Badge</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Unknown badge ID: {earnedBadge.id}</p>
            <p className="text-xs text-muted-foreground">Achieved: {format(new Date(earnedBadge.dateAchieved), "PPP")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    return unknownBadgeDisplay;
  }

  const IconComponent = definition.icon;

  const knownBadgeDisplay = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-default",
              className
            )}
          >
            <IconComponent className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium truncate">{definition.name}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex items-center gap-2 mb-1">
            <IconComponent className="h-5 w-5 text-primary" />
            <p className="font-semibold text-base">{definition.name}</p>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{definition.description}</p>
          <p className="text-xs text-muted-foreground">Criteria: {definition.criteriaDescription}</p>
          <p className="text-xs text-muted-foreground">Achieved: {format(new Date(earnedBadge.dateAchieved), "PPP")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
  return knownBadgeDisplay;
}
