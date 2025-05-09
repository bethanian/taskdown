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
import type { Priority as PriorityType, TaskStatus as TaskStatusType } from '@/lib/types';
import { TASK_STATUS_OPTIONS } from '@/lib/types';

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

const PriorityEnum = z.enum(['high', 'medium', 'low', 'none']);
const TaskStatusEnum = z.enum(TASK_STATUS_OPTIONS as [TaskStatusType, ...TaskStatusType[]]);


const UpdateTaskDetailsSchema = z.object({
  taskIdentifier: z.string().describe('The current text of the task to be updated. This is used to find the task.'),
  newText: z.string().optional().describe('The new text content for the task, if it is being renamed.'),
  status: TaskStatusEnum.optional().describe('The new status for the task.'),
  priority: PriorityEnum.optional().describe('The new priority for the task.'),
  assignedTo: z.string().optional().describe('The name of the new assignee for the task. Provide an empty string or omit to unassign if explicitly stated by user.'),
  tags: z.array(z.string()).optional().describe('The complete new list of tags for the task. If provided, this will replace all existing tags on the task.'),
  notes: z.string().optional().describe('The new notes for the task. If provided, this will replace all existing notes on the task.'),
});
export type UpdateTaskDetails = z.infer<typeof UpdateTaskDetailsSchema>;


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
  tasksToUpdate: z
    .array(UpdateTaskDetailsSchema)
    .describe('A list of tasks to be updated, identified by their current text, with new details.'),
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
Parse the user's natural language input to identify tasks to add, tasks to remove, and tasks to update.
The user might specify tasks and subtasks. Subtasks are often indicated by phrases like "under [Parent Task Name]", "with subtasks:", "subtasks for [Parent Task Name]:", or using indentation-like phrasing.
Multiple tasks can be separated by semicolons, "and", or new lines.
If the user asks for subtask suggestions for a named project or task (e.g., 'suggest subtasks for Project Alpha', 'create a task Birthday Party and suggest subtasks'), you should create the main project/task, and then generate 2-4 relevant subtasks under it. These suggested subtasks should also go into the 'tasksToAdd' array with the 'parentTaskText' field pointing to the main project/task text.

Input: "{{naturalLanguageInput}}"

Desired output format is a JSON object with three main keys: "tasksToAdd", "tasksToRemove", and "tasksToUpdate".
- "tasksToAdd": Array of objects for new tasks. Each object:
  - "text": Task description.
  - "parentTaskText" (optional): Parent task text if it's a subtask.
- "tasksToRemove": Array of objects for tasks to delete. Each object:
  - "text": Exact text of the task to remove.
- "tasksToUpdate": Array of objects for tasks to modify. Each object:
  - "taskIdentifier": The CURRENT text of the task to update. This is crucial for finding the task.
  - "newText" (optional): The new text if the task is being renamed.
  - "status" (optional): New status (e.g., "To Do", "In Progress", "Done", "Blocked").
  - "priority" (optional): New priority (e.g., "high", "medium", "low", "none").
  - "assignedTo" (optional): New assignee name. If user says to unassign, you can provide an empty string "" or omit this field.
  - "tags" (optional): A COMPLETE new list of tags. This will REPLACE existing tags.
  - "notes" (optional): New notes. This will REPLACE existing notes.

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
     ],
     "tasksToUpdate": []
   }

2. Input: "Update 'Launch Prep': set status to In Progress, priority high, assign to Dave, tags: [marketing, Q3]. Add note: 'Coordinate with PR team.'"
   Output: {
     "tasksToAdd": [],
     "tasksToRemove": [],
     "tasksToUpdate": [
       {
         "taskIdentifier": "Launch Prep",
         "status": "In Progress",
         "priority": "high",
         "assignedTo": "Dave",
         "tags": ["marketing", "Q3"],
         "notes": "Coordinate with PR team."
       }
     ]
   }

3. Input: "Add task: Call mom. Rename 'Old Meeting' to 'Client Sync'. Delete task: Pay bills."
    Output: {
      "tasksToAdd": [
        { "text": "Call mom" }
      ],
      "tasksToRemove": [
        { "text": "Pay bills" }
      ],
      "tasksToUpdate": [
        {
          "taskIdentifier": "Old Meeting",
          "newText": "Client Sync"
        }
      ]
    }

4. Input: "Round System, Gun System; with subtasks under Gun System: Ammo, Reload. Set 'Round System' priority to medium."
    Output: {
        "tasksToAdd": [
            { "text": "Round System" },
            { "text": "Gun System" },
            { "text": "Ammo", "parentTaskText": "Gun System" },
            { "text": "Reload", "parentTaskText": "Gun System" }
        ],
        "tasksToRemove": [],
        "tasksToUpdate": [
            {
                "taskIdentifier": "Round System",
                "priority": "medium"
            }
        ]
    }

5. Input: "Change task 'Fix Bugs' to 'Resolve Critical Bugs', status Blocked. Remove Shopping list. Add Groceries with subtasks Apples, Bananas"
    Output: {
        "tasksToAdd": [
            { "text": "Groceries" },
            { "text": "Apples", "parentTaskText": "Groceries" },
            { "text": "Bananas", "parentTaskText": "Groceries" }
        ],
        "tasksToRemove": [
            { "text": "Shopping list" }
        ],
        "tasksToUpdate": [
            {
                "taskIdentifier": "Fix Bugs",
                "newText": "Resolve Critical Bugs",
                "status": "Blocked"
            }
        ]
    }

6. Input: "Assign 'Review Design' to 'Alice' and add tag 'review'. Unassign 'Submit Report'."
   Output: {
     "tasksToAdd": [],
     "tasksToRemove": [],
     "tasksToUpdate": [
       {
         "taskIdentifier": "Review Design",
         "assignedTo": "Alice",
         "tags": ["review"] // Assuming only one tag was mentioned to be added, so existing tags are replaced if not specified further.
       },
       {
         "taskIdentifier": "Submit Report",
         "assignedTo": "" // Indicate unassignment
       }
     ]
   }

7. Input: "Create a project named 'Client Onboarding', suggest some subtasks for it. Also, delete task 'Old Notes'"
   Output: {
     "tasksToAdd": [
       { "text": "Client Onboarding" },
       { "text": "Initial consultation call", "parentTaskText": "Client Onboarding" },
       { "text": "Send welcome package", "parentTaskText": "Client Onboarding" },
       { "text": "Set up project in internal tools", "parentTaskText": "Client Onboarding" },
       { "text": "Schedule kick-off meeting", "parentTaskText": "Client Onboarding" }
     ],
     "tasksToRemove": [
       { "text": "Old Notes" }
     ],
     "tasksToUpdate": []
   }


Make sure to correctly identify parent-child relationships for subtasks.
If no tasks are to be added, removed, or updated, return empty arrays for the respective keys.
The "text" field in "tasksToAdd" should be the pure task description without prefixes like "Add task:".
For "tasksToUpdate", "taskIdentifier" MUST be the current name of the task. If renaming, "newText" should be the new name.
If a field is not mentioned for update, do not include it in the "tasksToUpdate" object for that task (e.g., if only priority changes, only include "taskIdentifier" and "priority").
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
      return { tasksToAdd: [], tasksToRemove: [], tasksToUpdate: [] };
    }
    // Ensure the output conforms to the schema, especially empty arrays if nothing to add/remove/update
    return {
        tasksToAdd: output.tasksToAdd || [],
        tasksToRemove: output.tasksToRemove || [],
        tasksToUpdate: output.tasksToUpdate || [],
    };
  }
);

    