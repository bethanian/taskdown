'use server';
/**
 * @fileOverview Processes natural language input to manage tasks.
 *
 * - processTaskInput - A function that handles natural language task processing.
 * - ProcessTaskInput - The input type for the processTaskInput function.
 * - ProcessTaskOutput - The return type for the processTaskInput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit'; // Use z from genkit as per guidelines

const ProcessedTaskSchema = z.object({
  text: z.string().describe('The text content of the task.'),
  parentTaskText: z
    .string()
    .optional()
    .describe(
      'The text of the parent task if this is a subtask. Omit if it is a top-level task.'
    ),
});
export type ProcessedTask = z.infer<typeof ProcessedTaskSchema>;

const ProcessTaskInputSchema = z.object({
  naturalLanguageInput: z
    .string()
    .describe('The natural language input from the user for task management.'),
});
export type ProcessTaskInput = z.infer<typeof ProcessTaskInputSchema>;

const ProcessTaskOutputSchema = z.object({
  tasksToAdd: z
    .array(ProcessedTaskSchema)
    .describe('A list of tasks to be added, potentially with parent references.'),
  tasksToRemove: z
    .array(z.object({text: z.string().describe('The text of the task to remove.')}))
    .describe('A list of tasks to be removed, identified by their text.'),
});
export type ProcessTaskOutput = z.infer<typeof ProcessTaskOutputSchema>;

export async function processTaskInput(
  input: ProcessTaskInput
): Promise<ProcessTaskOutput> {
  return processTaskInputFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processTaskInputPrompt',
  input: {schema: ProcessTaskInputSchema},
  output: {schema: ProcessTaskOutputSchema},
  prompt: `You are an intelligent task management assistant.
Parse the user's natural language input to identify tasks to add and tasks to remove.
The user might specify tasks and subtasks. Subtasks are often indicated by phrases like "under [Parent Task Name]", "with subtasks:", "subtasks for [Parent Task Name]:", or using indentation-like phrasing (e.g., a list where indented items are subtasks of the preceding non-indented item).
Multiple tasks can be separated by semicolons, "and", or new lines.

Input: "{{naturalLanguageInput}}"

Desired output format is a JSON object with two main keys: "tasksToAdd" and "tasksToRemove".
"tasksToAdd" should be an array of objects, where each object has:
- "text": The task description.
- "parentTaskText" (optional): The text of the parent task if it's a subtask. If it's a top-level task, omit this field.

"tasksToRemove" should be an array of objects, where each object has:
- "text": The exact text of the task to be removed.

Examples:
1. Input: "Create tasks: Plan vacation; Book flights under Plan vacation; Pack bags. Remove old task: Finish report."
   Output: {
     "tasksToAdd": [
       { "text": "Plan vacation" },
       { "text": "Book flights", "parentTaskText": "Plan vacation" },
       { "text": "Pack bags" }
     ],
     "tasksToRemove": [
       { "text": "Finish report" }
     ]
   }

2. Input: "Add new project: Website Redesign. Subtasks for Website Redesign: Wireframes, Mockups, Development. And also, grocery shopping."
   Output: {
     "tasksToAdd": [
       { "text": "Website Redesign" },
       { "text": "Wireframes", "parentTaskText": "Website Redesign" },
       { "text": "Mockups", "parentTaskText": "Website Redesign" },
       { "text": "Development", "parentTaskText": "Website Redesign" },
       { "text": "grocery shopping" }
     ],
     "tasksToRemove": []
   }

3. Input: "Delete task: Pay bills. Add task: Call mom"
    Output: {
      "tasksToAdd": [
        { "text": "Call mom" }
      ],
      "tasksToRemove": [
        { "text": "Pay bills" }
      ]
    }

4. Input: "Round System, Gun System; with subtasks under Gun System: Ammo, Reload"
    Output: {
        "tasksToAdd": [
            { "text": "Round System" },
            { "text": "Gun System" },
            { "text": "Ammo", "parentTaskText": "Gun System" },
            { "text": "Reload", "parentTaskText": "Gun System" }
        ],
        "tasksToRemove": []
    }

5. Input: "Remove Shopping list. Add Groceries with subtasks Apples, Bananas"
    Output: {
        "tasksToAdd": [
            { "text": "Groceries" },
            { "text": "Apples", "parentTaskText": "Groceries" },
            { "text": "Bananas", "parentTaskText": "Groceries" }
        ],
        "tasksToRemove": [
            { "text": "Shopping list" }
        ]
    }

Make sure to correctly identify parent-child relationships for subtasks.
If no tasks are to be added or removed, return empty arrays for the respective keys.
The "text" field should be the pure task description without prefixes like "Add task:" or "Create task:".
`,
});

const processTaskInputFlow = ai.defineFlow(
  {
    name: 'processTaskInputFlow',
    inputSchema: ProcessTaskInputSchema,
    outputSchema: ProcessTaskOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      console.error("AI prompt did not return a valid output for processTaskInputFlow. Input was:", input);
      // Return a default empty structure to prevent crashes downstream
      return { tasksToAdd: [], tasksToRemove: [] };
    }
    // Ensure the output conforms to the schema, especially empty arrays if nothing to add/remove
    return {
        tasksToAdd: output.tasksToAdd || [],
        tasksToRemove: output.tasksToRemove || [],
    };
  }
);
