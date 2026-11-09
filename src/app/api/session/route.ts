import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, setSessionUserId } from "@/lib/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

function generateDisplayName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let suffix = "";
  for (const b of bytes) suffix += chars[b % chars.length];
  return `Thinker-${suffix}`;
}

// POST /api/session — resume the cookie's anonymous identity, or create one.
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const existingId = await getSessionUserId();

    if (existingId) {
      const { data, error } = await supabase
        .from("users")
        .select("display_name")
        .eq("id", existingId)
        .maybeSingle();
      if (error) throw error;
      if (data) return Response.json({ displayName: data.display_name });
      // Cookie points at a user that no longer exists (e.g. DB reset): mint a new one.
    }

    // Each new identity is a database row, so cap how fast one IP can mint them.
    const limit = rateLimit(`session:${clientIp(req)}`, 10, 60 * 60 * 1000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

    const { data, error } = await supabase
      .from("users")
      .insert({ display_name: generateDisplayName() })
      .select("id, display_name")
      .single();
    if (error) throw error;

    await setSessionUserId(data.id);
    return Response.json({ displayName: data.display_name });
  } catch (e) {
    console.error("Session error:", e);
    return Response.json({ error: "Could not start a session" }, { status: 500 });
  }
}
