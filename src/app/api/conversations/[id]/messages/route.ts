import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, notFound, unauthorized } from "@/lib/session";
import { loadThread, ownsConversation } from "@/lib/conversations";

type Params = { params: Promise<{ id: string }> };

// GET /api/conversations/[id]/messages — messages for the conversation and the ones it replies to.
// (Messages are written by /api/chat once a reply finishes; there is no client write path.)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    if (!(await ownsConversation(supabase, userId, id))) return notFound();

    return Response.json(await loadThread(supabase, userId, id));
  } catch (e) {
    console.error("Load messages error:", e);
    return Response.json({ error: "Could not load messages" }, { status: 500 });
  }
}
