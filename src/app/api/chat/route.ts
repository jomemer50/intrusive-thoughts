import { NextRequest } from "next/server";
import { UIMessage as VercelChatMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { PHILOSOPHY_SYSTEM_PROMPT } from "@/lib/prompts";



export async function POST(req: NextRequest) {
  try {
    // LangChain configuration for NVIDIA NIM
    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: "meta/llama-3.1-70b-instruct",
      maxTokens: 4096,
      apiKey: process.env.NVIDIA_API_KEY || "your_nvidia_api_key",
      configuration: {
        baseURL: "https://integrate.api.nvidia.com/v1",
      }
    });

    const { messages, conversationId, userId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response("Bad Request", { status: 400 });
    }

    // Prepare LangChain messages
    const formattedMessages = messages.map((m: VercelChatMessage) => {
      const textContent = (m as any).content || m.parts?.filter(p => p.type === 'text').map(p => (p as any).text).join('') || '';
      
      if (m.role === "user") {
        return new HumanMessage(textContent);
      } else if (m.role === "assistant") {
        return new AIMessage(textContent);
      } else {
        return new SystemMessage(textContent);
      }
    });

    // Prepend the system prompt
    formattedMessages.unshift(new SystemMessage(PHILOSOPHY_SYSTEM_PROMPT));

    // Call Cloud LLM
    const langchainStream = await model.stream(formattedMessages);

    // Create and return the stream — persistence is handled client-side
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(toUIMessageStream(langchainStream));
      },
    });

    return createUIMessageStreamResponse({ stream });

  } catch (e: any) {
    console.error("Chat API Error:", e);
    return new Response(e.message || "Something went wrong", { status: 500 });
  }
}