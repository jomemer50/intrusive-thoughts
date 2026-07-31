import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/network — fetch all conversations from the last 24 hours for the graph
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch conversations with user display names and message counts
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        user_id,
        parent_conversation_id,
        title,
        created_at,
        updated_at,
        users(display_name)
      `)
      .gte("updated_at", twentyFourHoursAgo)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (convError) {
      return Response.json({ error: convError.message }, { status: 500 });
    }

    // Get message counts for each conversation
    const conversationIds = (conversations || []).map(c => c.id);

    let messageCounts: Record<string, number> = {};

    if (conversationIds.length > 0) {
      // Fetch message counts in batches
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds);

      if (!msgError && messages) {
        for (const msg of messages) {
          messageCounts[msg.conversation_id] = (messageCounts[msg.conversation_id] || 0) + 1;
        }
      }
    }

    // Transform for the graph
    const nodes = (conversations || []).map(c => ({
      id: c.id,
      userId: c.user_id,
      parentId: c.parent_conversation_id,
      title: c.title,
      displayName: (c.users as any)?.display_name || 'Unknown',
      messageCount: messageCounts[c.id] || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return Response.json({ nodes });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
