import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, isUuid, notFound, unauthorized } from "@/lib/session";
import { MAX_TITLE_CHARS } from "@/lib/conversations";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/conversations/[id] — rename one of the session user's conversations.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return notFound();

    const { title } = await req.json().catch(() => ({}));
    if (typeof title !== "string" || !title.trim()) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("conversations")
      .update({ title: title.trim().slice(0, MAX_TITLE_CHARS), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, parent_conversation_id, title, created_at, updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return notFound();

    return Response.json(data);
  } catch (e) {
    console.error("Rename conversation error:", e);
    return Response.json({ error: "Could not update conversation" }, { status: 500 });
  }
}

// DELETE /api/conversations/[id] — delete one of the session user's conversations.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return notFound();

    const { data, error } = await getSupabaseAdmin()
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return notFound();

    return Response.json({ success: true });
  } catch (e) {
    console.error("Delete conversation error:", e);
    return Response.json({ error: "Could not delete conversation" }, { status: 500 });
  }
}
