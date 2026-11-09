import "server-only";

// Fixed-window, in-memory rate limiter.
//
// This is per server instance: on a single Node process (`next start`) it is
// exact; on serverless it limits per warm instance only. For multi-instance
// deployments swap this for a shared store (e.g. Upstash Redis) — the call
// sites only depend on `rateLimit(key, limit, windowMs)`.
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, w] of windows) {
        if (w.resetAt <= now) windows.delete(k);
      }
      // Still full of live windows: drop the oldest entry rather than grow unbounded.
      if (windows.size >= MAX_KEYS) {
        const oldest = windows.keys().next().value;
        if (oldest !== undefined) windows.delete(oldest);
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function tooManyRequests(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests — slow down a little." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
