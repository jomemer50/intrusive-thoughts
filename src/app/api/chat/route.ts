import { NextRequest } from "next/server";
import { UIMessage as VercelChatMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { PHILOSOPHY_SYSTEM_PROMPT } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { MAX_MESSAGE_CHARS, ownsConversation } from "@/lib/conversations";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Only the most recent turns are forwarded to the model.
const MAX_HISTORY_MESSAGES = 40;

function textOf(m: VercelChatMessage): string {
  return (m.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    // The endpoint spends the server's model credits, so cap it per user.
    const limit = rateLimit(`chat:${userId}`, 20, 60 * 1000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

    const { messages, conversationId } = await req.json().catch(() => ({}));

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Bad Request", { status: 400 });
    }
    if (!(await ownsConversation(getSupabaseAdmin(), userId, conversationId))) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Only user/assistant turns are accepted from the client. A "system" message
    // in the request body would otherwise be forwarded with system authority and
    // could override PHILOSOPHY_SYSTEM_PROMPT.
    const history = (messages as VercelChatMessage[])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, text: textOf(m) }));

    if (history.some((m) => m.text.length > MAX_MESSAGE_CHARS * 4)) {
      return Response.json({ error: "Message too long" }, { status: 413 });
    }
    const latest = history[history.length - 1];
    if (!latest || latest.role !== "user" || !latest.text.trim() || latest.text.length > MAX_MESSAGE_CHARS) {
      return Response.json({ error: "Invalid message" }, { status: 400 });
    }

    const formattedMessages = [
      new SystemMessage(PHILOSOPHY_SYSTEM_PROMPT),
      ...history.map((m) => (m.role === "user" ? new HumanMessage(m.text) : new AIMessage(m.text))),
    ];

    // LangChain configuration for NVIDIA NIM
    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: "meta/llama-3.1-70b-instruct",
      maxTokens: 4096,
      apiKey: process.env.NVIDIA_API_KEY || "your_nvidia_api_key",
      configuration: {
        baseURL: "https://integrate.api.nvidia.com/v1",
      },
    });

    const langchainStream = await model.stream(formattedMessages);

    // Create and return the stream — persistence is handled client-side
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(toUIMessageStream(langchainStream));
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    console.error("Chat API Error:", e);
    return new Response("Something went wrong", { status: 500 });
  }
}
