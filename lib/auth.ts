import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { authOptions } from "@/lib/auth-config";
import { db } from "@/lib/db";

export const auth = betterAuth({
  ...authOptions(db),
  // bearer hands back the session token as `set-auth-token` on sign-in and
  // folds `Authorization: Bearer <token>` back into the session cookie before
  // the endpoint runs, so /api/todos verifies a CLI and the browser with one
  // `getSession` and a signed-out session stops working everywhere at once.
  // nextCookies mirrors Set-Cookie into next/headers, so it must stay last.
  plugins: [bearer(), nextCookies()],
});
