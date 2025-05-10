
"use client";

import React, { useState, useEffect } from 'react';
import type { TaskFilters, TaskSort, Priority, TaskStatus, SortableTaskFields } from '@/lib/types';
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS, SORTABLE_FIELD_OPTIONS, DEFAULT_FILTERS, DEFAULT_SORT } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Filter, ListFilter, RotateCcw, SortAsc, SortDesc, X } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface FilterSortControlsProps {
  currentFilters: TaskFilters;
  currentSort: TaskSort;
  onApply: (filters: TaskFilters, sort: TaskSort) => void;
}

export function FilterSortControls({ currentFilters, currentSort, onApply }: FilterSortControlsProps) {
  const [localFilters, setLocalFilters] = useState<TaskFilters>(currentFilters);
  const [localSort, setLocalSort] = useState<TaskSort>(currentSort);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setLocalFilters(currentFilters);
    setLocalSort(currentSort);
  }, [currentFilters, currentSort]);

  const handleFilterChange = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePriorityChange = (priority: Priority, checked: boolean) => {
    setLocalFilters(prev => {
      const newPriorities = checked
        ? [...prev.priorities, priority]
        : prev.priorities.filter(p => p !== priority);
      return { ...prev, priorities: newPriorities };
    });
  };

  const handleStatusChange = (status: TaskStatus, checked: boolean) => {
    setLocalFilters(prev => {
      const newStatuses = checked
        ? [...prev.statuses, status]
        : prev.statuses.filter(s => s !== status);
      return { ...prev, statuses: newStatuses };
    });
  };

  const handleSortFieldChange = (field: SortableTaskFields) => {
    setLocalSort(prev => ({ ...prev, field }));
  };

  const handleSortDirectionChange = (direction: 'asc' | 'desc') => {
    setLocalSort(prev => ({ ...prev, direction }));
  };

  const handleApply = () => {
    onApply(localFilters, localSort);
    setPopoverOpen(false);
  };

  const handleReset = () => {
    setLocalFilters(DEFAULT_FILTERS);
    setLocalSort(DEFAULT_SORT);
    onApply(DEFAULT_FILTERS, DEFAULT_SORT); // Immediately apply reset
    setPopoverOpen(false);
  };
  
  const activeFilterCount = [
    localFilters.dueDateStart,
    localFilters.dueDateEnd,
    localFilters.priorities.length > 0,
    localFilters.assignee && localFilters.assignee.trim() !== '',
    localFilters.statuses.length > 0,
  ].filter(Boolean).length;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <ListFilter className="mr-2 h-4 w-4" />
          Filter & Sort
          {activeFilterCount > 0 && (
             <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-screen max-w-sm sm:max-w-md p-0" align="end">
        <ScrollArea className="max-h-[70vh]">
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-primary flex items-center">
              <Filter className="mr-2 h-5 w-5" /> Filters
            </h3>

            {/* Due Date */}
            <div className="space-y-2 mb-4">
              <Label className="font-medium">Due Date</Label>
              <div className="grid grid-cols-2 gap-2">
                <DatePicker 
                  date={localFilters.dueDateStart || undefined} 
                  setDate={(date) => handleFilterChange('dueDateStart', date)}
                  placeholder="Start date"
                />
                <DatePicker 
                  date={localFilters.dueDateEnd || undefined} 
                  setDate={(date) => handleFilterChange('dueDateEnd', date)}
                  placeholder="End date"
                />
              </div>
            </div>

            {/* Priorities */}
            <div className="space-y-2 mb-4">
              <Label className="font-medium">Priority</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map(priority => (
                  <div key={priority} className="flex items-center space-x-2">
                    <Checkbox
                      id={`priority-${priority}`}
                      checked={localFilters.priorities.includes(priority)}
                      onCheckedChange={(checked) => handlePriorityChange(priority, !!checked)}
                    />
                    <Label htmlFor={`priority-${priority}`} className="text-sm capitalize cursor-pointer">{priority}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Statuses */}
            <div className="space-y-2 mb-4">
              <Label className="font-medium">Status</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TASK_STATUS_OPTIONS.map(status => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={localFilters.statuses.includes(status)}
                      onCheckedChange={(checked) => handleStatusChange(status, !!checked)}
                    />
                    <Label htmlFor={`status-${status}`} className="text-sm capitalize cursor-pointer">{status}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label htmlFor="filter-assignee" className="font-medium">Assigned To</Label>
              <Input
                id="filter-assignee"
                value={localFilters.assignee || ''}
                onChange={(e) => handleFilterChange('assignee', e.target.value)}
                placeholder="Assignee name"
              />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-3 text-primary flex items-center">
              {localSort.direction === 'asc' ? <SortAsc className="mr-2 h-5 w-5" /> : <SortDesc className="mr-2 h-5 w-5" />}
               Sort
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sort-field" className="font-medium">Sort By</Label>
                <Select value={localSort.field} onValueChange={(value) => handleSortFieldChange(value as SortableTaskFields)}>
                  <SelectTrigger id="sort-field">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTABLE_FIELD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sort-direction" className="font-medium">Direction</Label>
                <Select value={localSort.direction} onValueChange={(value) => handleSortDirectionChange(value as 'asc' | 'desc')}>
                  <SelectTrigger id="sort-direction">
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-muted/50">
            <Button variant="ghost" onClick={handleReset} className="text-sm">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
            <Button onClick={handleApply} className="text-sm">
              <Filter className="mr-2 h-4 w-4" /> Apply
            </Button>
        </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
