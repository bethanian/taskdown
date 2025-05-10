
"use client";

import React from 'react';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, UserCircle, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GoogleConnectButton() {
  const { isSignedIn, login, logout, profile, isLoading } = useGoogleAuth();

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (isSignedIn && profile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile.picture} alt={profile.name} />
              <AvatarFallback>
                {profile.name ? profile.name.charAt(0).toUpperCase() : <UserCircle className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline truncate max-w-[100px]">{profile.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="truncate">Connected as {profile.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive-foreground focus:bg-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect Google
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={login} variant="outline">
      <LogIn className="mr-2 h-4 w-4" /> Connect to Google Calendar
    </Button>
  );
}
