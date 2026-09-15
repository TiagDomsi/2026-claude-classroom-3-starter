import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTodoRequestSchema, listTodosQuerySchema } from "@/lib/todo-api";
import { addTodoFor, listTodosFor } from "@/lib/todo-tools";

/**
 * The todo list over HTTP, for CLIs and other services as much as for our own
 * sidebar. The browser sends the session cookie and a CLI sends
 * `Authorization: Bearer <token>`; the bearer plugin in lib/auth.ts turns the
 * second into the first before the endpoint runs, so one `getSession` covers
 * both. Reading `request.headers` rather than next/headers is also what lets
 * the Vitest suite call these handlers directly.
 *
 * The statements come from lib/todo-tools.ts, so the API and the tutor's tools
 * cannot drift apart, and every shape here is a schema in lib/todo-api.ts.
 */
async function userIdFor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id;
}

const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET(request: Request) {
  const userId = await userIdFor(request);
  if (!userId) {
    return unauthorized();
  }

  const query = listTodosQuerySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? undefined,
  });
  if (!query.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }

  return Response.json({ todos: await listTodosFor(db, userId, query.data.q) });
}

export async function POST(request: Request) {
  const userId = await userIdFor(request);
  if (!userId) {
    return unauthorized();
  }

  const body = createTodoRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  return Response.json(
    { todo: await addTodoFor(db, userId, body.data.title) },
    { status: 201 },
  );
}
