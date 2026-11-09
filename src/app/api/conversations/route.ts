import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { MAX_TITLE_CHARS, ownsConversation } from "@/lib/conversations";

const CONVERSATION_FIELDS = "id, parent_conversation_id, title, created_at, updated_at";

// GET /api/conversations — the session user's conversations, newest first.
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { data, error } = await getSupabaseAdmin()
      .from("conversations")
      .select(CONVERSATION_FIELDS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return Response.json(data);
  } catch (e) {
    console.error("List conversations error:", e);
    return Response.json({ error: "Could not load conversations" }, { status: 500 });
  }
}

// POST /api/conversations — create a conversation, optionally replying to one of the user's own.
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const supabase = getSupabaseAdmin();
    const { title, parentConversationId } = await req.json().catch(() => ({}));

    if (parentConversationId != null && !(await ownsConversation(supabase, userId, parentConversationId))) {
      return Response.json({ error: "Parent conversation not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title: typeof title === "string" && title.trim() ? title.trim().slice(0, MAX_TITLE_CHARS) : "New Thought",
        parent_conversation_id: parentConversationId ?? null,
      })
      .select(CONVERSATION_FIELDS)
      .single();
    if (error) throw error;

    return Response.json(data);
  } catch (e) {
    console.error("Create conversation error:", e);
    return Response.json({ error: "Could not create conversation" }, { status: 500 });
  }
}
