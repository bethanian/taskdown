# Taskdown Project

## Database Schema

### `tasks` Table

| Column        | Type        | Default Value         | Nullable | Notes                                                                 |
|---------------|-------------|-----------------------|----------|-----------------------------------------------------------------------|
| `id`          | `uuid`      | `gen_random_uuid()`   | No       | Primary Key                                                           |
| `title`       | `text`      |                       | No       | The main title or description of the task.                            |
| `created_at`  | `timestamp` | `now()`               | No       |                                                                       |
| `update_at`   | `timestamp` | `now()`               | No       |                                                                       |
| `completed`   | `bool`      | `false`               | No       |                                                                       |
| `priority`    | `text`      | `"none"::text`        | No       |                                                                       |
| `status`      | `text`      | `"To Do"::text`       | No       |                                                                       |
| `due_date`    | `timestamp` | `NULL`                | Yes      |                                                                       |
| `notes`       | `text`      | `NULL`                | Yes      |                                                                       |
| `tags`        | `jsonb`     | `'[]'::jsonb`         | No       |                                                                       |
| `assigned_to` | `text`      | `NULL`                | Yes      |                                                                       |
| `share_id`    | `text`      | `NULL`                | Yes      | Unique ID for view-only public sharing                                |
| `parent_id`   | `uuid`      | `NULL`                | Yes      | Foreign key to `tasks.id` (for subtasks).                               |
| `attachments` | `jsonb`     | `NULL`                | Yes      |                                                                       |
| `user_id`     | `uuid`      | `NULL`                | Yes      | Foreign key to `auth.users.id` (if applicable for user association).    |
| `recurrence`  | `text`      | `"none"::text`        | No       | Recurrence rule: 'none', 'daily', 'weekly', 'monthly', 'yearly'.      |
| `dependent_on`| `uuid`      | `NULL`                | Yes      | Foreign key to `tasks.id` (for task dependencies). Set to NULL on delete of referenced task. |

---

```