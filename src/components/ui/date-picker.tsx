"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react" // XIcon no longer needed

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar" // Import shadcn Calendar
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover" // Import Popover components

// react-datepicker and its CSS are no longer needed
// import ReactDatePicker from "react-datepicker"
// import "react-datepicker/dist/react-datepicker.css"
// import "@/styles/datepicker-custom.css" // This can be removed later if not used elsewhere

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({ date, setDate, disabled, placeholder = "Pick a date" }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Custom Input Component remains largely the same, used as PopoverTrigger
  const CustomInputTrigger = React.forwardRef<
    HTMLButtonElement,
    { value?: string; onClick?: () => void } // onClick is provided by PopoverTrigger
  >(({ value, onClick }, ref) => (
    <Button
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal",
        !date && "text-muted-foreground" // Use `date` prop directly for conditional styling
      )}
      onClick={onClick} // PopoverTrigger will handle this
      ref={ref}
      disabled={disabled}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {date ? format(date, "PPP") : <span>{placeholder}</span>}
    </Button>
  ));
  CustomInputTrigger.displayName = "CustomDatePickerInputTrigger";

  // CustomHeader is no longer needed as shadcn/ui Calendar handles its own navigation

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setOpen(false); // Close the popover on date selection
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {/* We pass the formatted date directly to the trigger now.
            The `value` prop for CustomInputTrigger is not strictly necessary
            if PopoverTrigger directly wraps the Button, but keeping it for clarity. */}
        <CustomInputTrigger
          value={date ? format(date, "PPP") : placeholder}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          disabled={disabled || ((d) => d < new Date("1900-01-01"))} // Example: disable past dates, or pass a function from props
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
