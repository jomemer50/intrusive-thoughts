import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/conversations/[id]/messages — fetch all messages for a conversation, including ancestors
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Use a recursive query (or just fetch the convo and its parent if it's 1-level)
    // Supabase JS doesn't support recursive queries natively without an RPC, 
    // so we will manually fetch the chain up to 5 levels deep.
    let currentId = id;
    let allMessages: any[] = [];
    let depth = 0;

    while (currentId && depth < 5) {
      // Fetch messages for current
      const { data: msgs, error: msgsErr } = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, created_at")
        .eq("conversation_id", currentId)
        .order("created_at", { ascending: true });

      if (msgsErr) throw msgsErr;
      if (msgs) {
        allMessages = [...msgs, ...allMessages];
      }

      // Fetch parent ID
      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .select("parent_conversation_id")
        .eq("id", currentId)
        .maybeSingle();
        
      if (convoErr) throw convoErr;
      currentId = convo?.parent_conversation_id;
      depth++;
    }

    // Sort all messages by created_at ascending to ensure chronological order
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return Response.json(allMessages);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/conversations/[id]/messages — save a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const { role, content } = await req.json();

    if (!role || !content) {
      return Response.json({ error: "role and content are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        role,
        content,
      })
      .select("id, conversation_id, role, content, created_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Update the conversation's updated_at timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
