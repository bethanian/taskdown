"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProcessTaskInput, ProcessTaskOutput } from '@/ai/flows/process-task-input-flow';

interface AiTaskInputFormProps {
  onProcessTasks: (input: ProcessTaskInput) => Promise<ProcessTaskOutput | null>;
  disabled?: boolean;
}

export function AiTaskInputForm({ onProcessTasks, disabled }: AiTaskInputFormProps) {
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAiInput(transcript);
        setIsListening(false);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        toast({
          title: "Speech Recognition Error",
          description: "There was an error with speech recognition. Please try again.",
          variant: "destructive",
        });
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, [toast]);

  const toggleListening = () => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      setAiInput('');
      recognition.start();
      setIsListening(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!aiInput.trim()) {
      toast({ title: "Info", description: "Please enter instructions for the AI." });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await onProcessTasks({ naturalLanguageInput: aiInput });
      if (result) {
        // Success toast will be handled by useTasks after applying changes
        setAiInput(''); // Clear input on success
      } else {
        // This case might be hit if onProcessTasks itself returns null due to an issue before calling the AI
        toast({
          title: "AI Processing Error",
          description: "Could not process your request. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI task processing error:", error);
      toast({
        title: "AI Task Error",
        description: "An error occurred while communicating with the AI. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder="E.g., 'Add: Project X with subtasks: A, B. Remove: Old meeting'"
          className="flex-grow"
          aria-label="AI task input"
          disabled={isProcessing || disabled || isListening}
        />
        <Button 
          type="button" 
          onClick={toggleListening}
          disabled={isProcessing || disabled}
          variant="outline"
          aria-label={isListening ? "Stop listening" : "Start voice input"}
        >
          {isListening ? (
            <MicOff className="h-5 w-5 text-red-500" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
        <Button type="submit" disabled={isProcessing || disabled || !aiInput.trim()} aria-label="Process with AI">
          <Sparkles className={`h-5 w-5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span className="ml-2 hidden sm:inline">{isProcessing ? 'Processing...' : 'AI Process'}</span>
        </Button>
      </div>
    </form>
  );
}
