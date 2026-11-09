import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/session";

export const MAX_TITLE_CHARS = 120;
export const MAX_MESSAGE_CHARS = 8_000;
// Reply chains are followed this many conversations up when loading history.
export const MAX_THREAD_DEPTH = 5;

export type StoredMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/** True when `conversationId` exists and belongs to `userId`. */
export async function ownsConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: unknown
): Promise<boolean> {
  if (!isUuid(conversationId)) return false;
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Messages of a conversation plus the conversations it replies to (up to
 * MAX_THREAD_DEPTH levels), oldest first. Every level is filtered by owner, so
 * a reply chain can never pull in another user's messages.
 */
export async function loadThread(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<StoredMessage[]> {
  const all: StoredMessage[] = [];
  let currentId: string | null = conversationId;

  for (let depth = 0; currentId && depth < MAX_THREAD_DEPTH; depth++) {
    const { data: convo, error: convoErr }: { data: { parent_conversation_id: string | null } | null; error: unknown } =
      await supabase
        .from("conversations")
        .select("parent_conversation_id")
        .eq("id", currentId)
        .eq("user_id", userId)
        .maybeSingle();
    if (convoErr) throw convoErr;
    if (!convo) break;

    const { data: msgs, error: msgsErr } = await supabase
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .eq("conversation_id", currentId)
      .order("created_at", { ascending: true });
    if (msgsErr) throw msgsErr;

    all.unshift(...((msgs ?? []) as StoredMessage[]));
    currentId = convo.parent_conversation_id;
  }

  return all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
