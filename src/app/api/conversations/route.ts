import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/conversations?userId=xxx — list user's own conversations
// GET /api/conversations?public=true — list all public conversations (last 24h)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("userId");

    let query = supabase
      .from("conversations")
      .select("id, user_id, parent_conversation_id, title, created_at, updated_at, users(display_name)")
      .order("updated_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/conversations — create a new conversation
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { userId, title, parentConversationId } = await req.json();

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const insertData: any = {
      user_id: userId,
      title: title || "New Thought",
    };

    if (parentConversationId) {
      insertData.parent_conversation_id = parentConversationId;
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert(insertData)
      .select("id, user_id, parent_conversation_id, title, created_at, updated_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
