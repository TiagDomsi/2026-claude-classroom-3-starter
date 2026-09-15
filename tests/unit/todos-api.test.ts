// @vitest-environment node
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { bearer, testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql/node";
import { afterAll, expect, test, vi } from "vitest";

import { authOptions } from "@/lib/auth-config";
import * as schema from "@/lib/schema";
import {
  createTodoResponseSchema,
  listTodosResponseSchema,
  setTodoDoneResponseSchema,
} from "@/lib/todo-api";
import { removeTempDir } from "./temp-dir";

// The handlers reach for the app's `server-only` db and auth instances, so both
// are replaced by ones on a throwaway file. The plugin array stays a literal
// so `ctx.test` keeps its types; bearer is there because it is what the routes
// are gated on in lib/auth.ts.
const dir = await mkdtemp(join(tmpdir(), "ai-tutor-todos-api-"));
const db = drizzle({
  connection: { url: `file:${join(dir, "api.db")}` },
  schema,
});
await migrate(db, { migrationsFolder: "./drizzle" });

const auth = betterAuth({
  ...authOptions(db),
  secret: "test-secret-at-least-32-characters-long",
  baseURL: "http://localhost:3000",
  plugins: [bearer(), testUtils()],
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ auth }));

const { GET, POST } = await import("@/app/api/todos/route");
const { PATCH } = await import("@/app/api/todos/[id]/route");

afterAll(async () => {
  db.$client.close();
  await removeTempDir(dir);
});

const url = (path = "") => `http://localhost:3000/api/todos${path}`;

/** PATCH's second argument is the context `next dev` would hand the handler. */
const patch = (id: string, init: RequestInit) =>
  PATCH(new Request(url(`/${id}`), { method: "PATCH", ...init }), {
    params: Promise.resolve({ id }),
  });

test("GET without a token is refused", async () => {
  const response = await GET(new Request(url()));

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
});

test("POST without a token is refused", async () => {
  const response = await POST(
    new Request(url(), {
      method: "POST",
      body: JSON.stringify({ title: "Smuggled in" }),
    }),
  );

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  expect(await db.select().from(schema.todos)).toEqual([]);
});

test("PATCH without a token is refused", async () => {
  const response = await patch("any-id", {
    body: JSON.stringify({ done: true }),
  });

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
});

test("a bearer token carries a CLI through add, list, complete and filter", async () => {
  const helpers = (await auth.$context).test;
  const user = await helpers.saveUser(
    helpers.createUser({ name: "Ada Lovelace", email: "ada@example.com" }),
  );
  // Better Auth mints it and, through the bearer plugin, verifies it again.
  const { token } = await helpers.login({ userId: user.id });
  const headers = { authorization: `Bearer ${token}` };

  const add = (title: string) =>
    POST(
      new Request(url(), {
        method: "POST",
        headers,
        body: JSON.stringify({ title }),
      }),
    );

  const created = await add("Buy milk");
  expect(created.status).toBe(201);
  const { todo } = createTodoResponseSchema.parse(await created.json());
  expect(todo).toMatchObject({ title: "Buy milk", done: false });

  // A second item so the filter below has something to leave out.
  expect((await add("Call the dentist")).status).toBe(201);

  const listed = await GET(new Request(url(), { headers }));
  expect(listed.status).toBe(200);
  expect(
    listTodosResponseSchema
      .parse(await listed.json())
      .todos.map((t) => t.title),
  ).toEqual(["Buy milk", "Call the dentist"]);

  const completed = await patch(todo.id, {
    headers,
    body: JSON.stringify({ done: true }),
  });
  expect(completed.status).toBe(200);
  expect(setTodoDoneResponseSchema.parse(await completed.json()).todo).toEqual({
    ...todo,
    done: true,
  });

  const filtered = await GET(new Request(url("?q=milk"), { headers }));
  expect(filtered.status).toBe(200);
  expect(listTodosResponseSchema.parse(await filtered.json()).todos).toEqual([
    { ...todo, done: true },
  ]);
});
