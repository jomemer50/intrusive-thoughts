import "server-only";
import { cookies } from "next/headers";

// Anonymous identity lives in an httpOnly cookie that holds the user's id.
// The id is a random v4 UUID created server-side and never returned by any
// API response, so it works as an unguessable bearer token. JavaScript in the
// page cannot read it (httpOnly) and SameSite=Lax keeps cross-site POST /
// PATCH / DELETE requests from carrying it.
export const SESSION_COOKIE = "it_session";
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function getSessionUserId(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return isUuid(value) ? value : null;
}

export async function setSessionUserId(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SEC,
  });
}

export function unauthorized(): Response {
  return Response.json({ error: "No session" }, { status: 401 });
}

export function notFound(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}
