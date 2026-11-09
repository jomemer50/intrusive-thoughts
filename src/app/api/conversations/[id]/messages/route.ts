import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, isUuid, notFound, unauthorized } from "@/lib/session";
import { loadThread, MAX_MESSAGE_CHARS, ownsConversation } from "@/lib/conversations";

type Params = { params: Promise<{ id: string }> };

// GET /api/conversations/[id]/messages — messages for the conversation and the ones it replies to.
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

// POST /api/conversations/[id]/messages — save a message to one of the session user's conversations.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return notFound();

    const { role, content } = await req.json().catch(() => ({}));
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content) {
      return Response.json({ error: "role ('user' | 'assistant') and content are required" }, { status: 400 });
    }
    if (content.length > MAX_MESSAGE_CHARS * 4) {
      return Response.json({ error: "Message too long" }, { status: 413 });
    }

    const supabase = getSupabaseAdmin();
    if (!(await ownsConversation(supabase, userId, id))) return notFound();

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, role, content })
      .select("id, conversation_id, role, content, created_at")
      .single();
    if (error) throw error;

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);

    return Response.json(data);
  } catch (e) {
    console.error("Save message error:", e);
    return Response.json({ error: "Could not save message" }, { status: 500 });
  }
}
