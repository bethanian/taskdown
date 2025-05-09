"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProcessTaskInput, ProcessTaskOutput } from '@/ai/flows/process-task-input-flow';

// TypeScript will now recognize SpeechRecognition and related types from @types/dom-speech-recognition

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Check if the browser supports SpeechRecognition
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognitionInstance = new SpeechRecognitionAPI();
      recognitionInstance.continuous = false; // Stop listening after the first result
      recognitionInstance.interimResults = false; // We only want final results

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setAiInput(transcript);
        setIsListening(false);
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = "There was an error with speech recognition. Please try again.";
        if (event.error === 'no-speech') {
          errorMessage = "No speech was detected. Please try again.";
        } else if (event.error === 'audio-capture') {
          errorMessage = "Audio capture failed. Please ensure your microphone is working.";
        } else if (event.error === 'not-allowed') {
          errorMessage = "Permission to use microphone was denied. Please enable it in your browser settings.";
        }
        toast({
          title: "Speech Recognition Error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    } else {
      // Optionally notify the user that speech recognition is not supported
      // console.log("Speech recognition not supported in this browser.");
    }
  }, [toast]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [aiInput]);

  const toggleListening = () => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition, or permission was denied.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognition.stop();
      // setIsListening will be set to false by the onend event
    } else {
      setAiInput(''); // Clear current input before starting new recognition
      try {
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        toast({
          title: "Could not start listening",
          description: "Please ensure microphone permissions are granted and try again.",
          variant: "destructive"
        });
      }
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
        setAiInput('');
      } else {
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
      <div className="flex gap-2 items-end"> {/* items-end for alignment when textarea grows */}
        <Textarea
          ref={textareaRef}
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder="E.g., 'Add: Project X with subtasks: A, B. Remove: Old meeting'"
          className="flex-grow resize-none overflow-hidden min-h-[40px] max-h-[200px]" // Added max-h
          aria-label="AI task input"
          disabled={isProcessing || disabled || isListening}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any); // Trigger form submission
            }
          }}
        />
        {/* Buttons are now direct children of the flex container */}
        <Button 
          type="button" 
          onClick={toggleListening}
          disabled={isProcessing || disabled}
          variant="outline"
          aria-label={isListening ? "Stop listening" : "Start voice input"}
          className="h-[40px] shrink-0" // Ensure buttons don't shrink
        >
          {isListening ? (
            <MicOff className="h-5 w-5 text-red-500" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
        <Button 
          type="submit" 
          disabled={isProcessing || disabled || !aiInput.trim()} 
          aria-label="Process with AI" 
          className="h-[40px] shrink-0" // Ensure buttons don't shrink
        >
          <Sparkles className={`h-5 w-5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span className="ml-2 hidden sm:inline">{isProcessing ? 'Processing...' : 'AI Process'}</span>
        </Button>
      </div>
    </form>
  );
}
