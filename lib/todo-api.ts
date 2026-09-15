import { z } from "zod";

/**
 * The wire contract of /api/todos, and nothing else: no database, no auth, no
 * `server-only`, so a CLI in this repo can import it to build requests and parse
 * responses against the very schemas the route handlers validate with.
 */

/** One item, the shape every endpoint and every tutor tool reports. */
export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
});

export type Todo = z.infer<typeof todoSchema>;

/**
 * GET /api/todos — `q` matches anywhere in the title, case-insensitively.
 * Blank counts as absent so `?q=` from a shell with an unset variable lists
 * everything instead of failing.
 */
export const listTodosQuerySchema = z.object({
  q: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

export const listTodosResponseSchema = z.object({ todos: z.array(todoSchema) });

/** POST /api/todos */
export const createTodoRequestSchema = z.object({
  title: z.string().trim().min(1).max(500),
});

export const createTodoResponseSchema = z.object({ todo: todoSchema });

/** PATCH /api/todos/{id} — `false` reopens the item, so this is not delete. */
export const setTodoDoneRequestSchema = z.object({ done: z.boolean() });

export const setTodoDoneResponseSchema = z.object({ todo: todoSchema });

/** Every non-2xx body: 401, 400 and 404 alike. */
export const errorResponseSchema = z.object({ error: z.string() });

export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
export type CreateTodoRequest = z.infer<typeof createTodoRequestSchema>;
export type SetTodoDoneRequest = z.infer<typeof setTodoDoneRequestSchema>;
