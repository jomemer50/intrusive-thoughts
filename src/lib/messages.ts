import type { UIMessage } from "ai";

export const DEFAULT_TITLES = ["New Thought", "Reply Thought"];
const TITLE_CHARS = 40;

/** Plain text of a UI message (AI SDK 5+ messages carry text in `parts`, not `content`). */
export function textOf(message: Pick<UIMessage, "parts">): string {
  return (message.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join("");
}

/** Sidebar title from the first thing the user typed; ellipsis only when actually truncated. */
export function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return DEFAULT_TITLES[0];
  return clean.length > TITLE_CHARS ? `${clean.slice(0, TITLE_CHARS - 1).trimEnd()}…` : clean;
}

export function toUIMessage(m: { id: string; role: "user" | "assistant"; content: string }): UIMessage {
  return { id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] };
}
