import { NextRequest } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { PHILOSOPHY_SYSTEM_PROMPT } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, isUuid, unauthorized } from "@/lib/session";
import { loadThread, MAX_MESSAGE_CHARS } from "@/lib/conversations";
import { DEFAULT_TITLES, makeTitle, textOf } from "@/lib/messages";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Only the most recent turns are forwarded to the model.
const MAX_HISTORY_MESSAGES = 40;

// Any OpenAI-compatible endpoint works; NVIDIA NIM is the default.
const LLM_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const LLM_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

// POST /api/chat — body: { conversationId, message } where message is the new user UIMessage.
//
// The database, not the client, is the source of truth for history: the server
// loads the thread, appends the new message, streams the reply, and stores the
// user + assistant pair together once the reply has finished. A turn that fails
// is not stored, so retrying it can't leave a duplicate or an orphaned question.
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    // The endpoint spends the server's model credits, so cap it per user.
    const limit = rateLimit(`chat:${userId}`, 20, 60 * 1000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      console.error("NVIDIA_API_KEY is not set");
      return Response.json({ error: "The model is not configured on this server." }, { status: 500 });
    }

    const { conversationId, message } = (await req.json().catch(() => ({}))) as {
      conversationId?: unknown;
      message?: UIMessage;
    };
    if (!isUuid(conversationId)) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }
    const userText = message && message.role === "user" ? textOf(message).trim() : "";
    if (!userText || userText.length > MAX_MESSAGE_CHARS) {
      return Response.json({ error: "Invalid message" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .select("id, title")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (convoErr) throw convoErr;
    if (!convo) return Response.json({ error: "Conversation not found" }, { status: 404 });

    const thread = await loadThread(supabase, userId, conversationId);
    const isFirstMessage = !thread.some((m) => m.conversation_id === conversationId);
    const receivedAt = new Date();

    const formattedMessages = [
      new SystemMessage(PHILOSOPHY_SYSTEM_PROMPT),
      ...thread
        .slice(-(MAX_HISTORY_MESSAGES - 1))
        .map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content))),
      new HumanMessage(userText),
    ];

    const model = new ChatOpenAI({
      temperature: 0.7,
      model: LLM_MODEL,
      maxTokens: 4096,
      // LangChain defaults to 6 retries with exponential backoff, which left the
      // user staring at a spinner for ~100s when the provider was down.
      maxRetries: 1,
      timeout: 60_000,
      apiKey,
      configuration: { baseURL: LLM_BASE_URL },
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(toUIMessageStream(await model.stream(formattedMessages, { signal: req.signal })));
      },
      onError: (error) => {
        console.error("Chat stream error:", error);
        return "The model didn't answer. Try again in a moment.";
      },
      onFinish: async ({ responseMessage, isAborted }) => {
        const assistantText = textOf(responseMessage).trim();
        // Nothing came back (model error, or aborted before the first token): store nothing.
        if (!assistantText) return;
        try {
          const finishedAt = new Date(Math.max(Date.now(), receivedAt.getTime() + 1));
          const { error } = await supabase.from("messages").insert([
            { conversation_id: conversationId, role: "user", content: userText, created_at: receivedAt.toISOString() },
            {
              conversation_id: conversationId,
              role: "assistant",
              content: isAborted ? `${assistantText}\n\n*(stopped)*` : assistantText,
              created_at: finishedAt.toISOString(),
            },
          ]);
          if (error) throw error;

          const update: { updated_at: string; title?: string } = { updated_at: finishedAt.toISOString() };
          if (isFirstMessage && DEFAULT_TITLES.includes(convo.title)) update.title = makeTitle(userText);
          await supabase.from("conversations").update(update).eq("id", conversationId).eq("user_id", userId);
        } catch (e) {
          console.error("Failed to persist chat turn:", e);
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    console.error("Chat API Error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
