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
import type { Priority as PriorityType, TaskStatus as TaskStatusType, RecurrenceRule } from '@/lib/types';
import { TASK_STATUS_OPTIONS, RECURRENCE_OPTIONS } from '@/lib/types';

const RecurrenceEnum = z.enum(RECURRENCE_OPTIONS as [RecurrenceRule, ...RecurrenceRule[]]);

const ProcessedTaskSchema = z.object({
  text: z.string().describe('The text content of the task.'),
  parentTaskText: z
    .string()
    .optional()
    .describe(
      'The text of the parent task if this is a subtask. Omit if it is a top-level task.'
    ),
  recurrence: RecurrenceEnum.optional().describe("The recurrence rule for the task (e.g., 'daily', 'weekly'). Defaults to 'none' if not specified."),
  dependentOnTaskText: z
    .string()
    .optional()
    .describe(
      'The text of the task that this new task depends on. Omit if there is no dependency.'
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
  recurrence: RecurrenceEnum.optional().describe("The new recurrence rule for the task. To remove recurrence, set to 'none' if explicitly stated."),
  dependentOnTaskText: z
    .string()
    .optional()
    .nullable() // Allow null to explicitly remove dependency
    .describe(
      'The text of the task that this task should now depend on. Provide an empty string or null to remove an existing dependency if explicitly stated by the user (e.g., "remove dependency").'
    ),
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
    .describe('A list of tasks to be added, potentially with parent references, recurrence rules, and dependencies.'),
  tasksToRemove: z
    .array(z.object({text: z.string().describe('The text of the task to remove.')}))
    .describe('A list of tasks to be removed, identified by their text.'),
  tasksToUpdate: z
    .array(UpdateTaskDetailsSchema)
    .describe('A list of tasks to be updated, identified by their current text, with new details including recurrence and dependencies.'),
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
Your primary goal is to understand the user's intent, even if their language is informal or doesn't follow strict commands.
Parse the user's natural language input to identify tasks to add, tasks to remove, and tasks to update.
If a user describes a project, goal, or activity (e.g., "plan a birthday party", "organize my study schedule for exams", "work on the new marketing campaign"), you should interpret this as a main task.
If they also ask for steps, suggestions, or an outline for such a project/goal, create the main task and then generate 2-4 relevant, actionable subtasks under it.
The user might specify tasks and subtasks. Subtasks are often indicated by phrases like "under [Parent Task Name]", "with subtasks:", "subtasks for [Parent Task Name]:", or using indentation-like phrasing.
Multiple tasks can be separated by semicolons, "and", or new lines.
Recognize recurrence patterns like "every day", "weekly", "monthly", "annually" or "yearly". Map these to 'daily', 'weekly', 'monthly', or 'yearly'. If no recurrence is specified, default to 'none'.
Recognize dependency phrases like "depends on [Task Name]", "after [Task Name]", "blocked by [Task Name]".

Input: "{{naturalLanguageInput}}"

Desired output format is a JSON object with three main keys: "tasksToAdd", "tasksToRemove", and "tasksToUpdate".
- "tasksToAdd": Array of objects for new tasks. Each object:
  - "text": Task description.
  - "parentTaskText" (optional): Parent task text if it's a subtask.
  - "recurrence" (optional): Recurrence rule ('none', 'daily', 'weekly', 'monthly', 'yearly'). Defaults to 'none'.
  - "dependentOnTaskText" (optional): Text of the task this new task depends on.
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
  - "recurrence" (optional): New recurrence rule. Set to 'none' to remove recurrence.
  - "dependentOnTaskText" (optional, nullable): Text of the task this task should depend on. Send null or "" if user wants to remove dependency (e.g., "remove dependency from X").

Examples:
1. Input: "Create tasks: Plan vacation; Book flights under Plan vacation depends on Plan vacation; Pack bags. Remove old task: Finish report."
   Output: {
     "tasksToAdd": [
       { "text": "Plan vacation" },
       { "text": "Book flights", "parentTaskText": "Plan vacation", "dependentOnTaskText": "Plan vacation" },
       { "text": "Pack bags" }
     ],
     "tasksToRemove": [
       { "text": "Finish report" }
     ],
     "tasksToUpdate": []
   }

2. Input: "Update 'Launch Prep': set status to In Progress, priority high, assign to Dave, tags: [marketing, Q3]. Add note: 'Coordinate with PR team.' Make it depend on 'Finalize budget'."
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
         "notes": "Coordinate with PR team.",
         "dependentOnTaskText": "Finalize budget"
       }
     ]
   }
   
3. Input: "Add task: Pay rent every month. Change 'Water plants' to repeat weekly. Task 'Review designs' is blocked by 'Gather feedback'."
   Output: {
     "tasksToAdd": [
       { "text": "Pay rent", "recurrence": "monthly" }
     ],
     "tasksToRemove": [],
     "tasksToUpdate": [
       { "taskIdentifier": "Water plants", "recurrence": "weekly" },
       { "taskIdentifier": "Review designs", "dependentOnTaskText": "Gather feedback" }
     ]
   }

4. Input: "Round System, Gun System; with subtasks under Gun System: Ammo, Reload. Set 'Round System' priority to medium. 'Ammo' depends on 'Gun System'."
    Output: {
        "tasksToAdd": [
            { "text": "Round System" },
            { "text": "Gun System" },
            { "text": "Ammo", "parentTaskText": "Gun System", "dependentOnTaskText": "Gun System" },
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

5. Input: "Remind me to take out trash daily. Mark 'Submit expenses' as not recurring and remove its dependency."
   Output: {
     "tasksToAdd": [
       { "text": "Take out trash", "recurrence": "daily" }
     ],
     "tasksToRemove": [],
     "tasksToUpdate": [
       { "taskIdentifier": "Submit expenses", "recurrence": "none", "dependentOnTaskText": null }
     ]
   }

Make sure to correctly identify parent-child relationships for subtasks.
If no tasks are to be added, removed, or updated, return empty arrays for the respective keys.
The "text" field in "tasksToAdd" should be the pure task description without prefixes like "Add task:".
For "tasksToUpdate", "taskIdentifier" MUST be the current name of the task. If renaming, "newText" should be the new name.
If a field is not mentioned for update, do not include it in the "tasksToUpdate" object for that task.
If the user mentions a project or high-level goal and asks for steps or an outline, create the main task first, then the steps as subtasks under it.
If a recurrence like "every year" or "annually" is mentioned, map it to "yearly".
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
      return { tasksToAdd: [], tasksToRemove: [], tasksToUpdate: [] };
    }
    return {
        tasksToAdd: output.tasksToAdd?.map(task => ({ ...task, recurrence: task.recurrence || 'none' })) || [],
        tasksToRemove: output.tasksToRemove || [],
        tasksToUpdate: output.tasksToUpdate || [],
    };
  }
);
