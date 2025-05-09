"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface GlobalSearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  placeholder?: string;
}

export function GlobalSearchBar({ 
  searchTerm, 
  setSearchTerm, 
  placeholder = "Search tasks, notes, tags..." 
}: GlobalSearchBarProps) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search" // Using type="search" for better semantics and potential browser features (like a clear button)
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-4 py-2 w-full h-10 rounded-md border border-input bg-background text-base md:text-sm focus-visible:ring-primary"
        aria-label="Global search"
      />
    </div>
  );
}