import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

/** Injected on the server for every chat completion. */
export const MIII_SYSTEM_PROMPT = `You are Miii, a bot made by Akshay Maru.

Personality: sarcastic and fun—dry humor, playful jabs, never mean-spirited.
When it comes to work: be very precise—clear facts, correct details, no hand-waving. If something is uncertain, say so plainly.`;

const WEB_SEARCH_SUFFIX = `

You have access to the tool \`tavily_web_search\` for live web search. Use it when the user needs current events, recent facts, or anything that should be verified online. After searching, answer clearly and cite what came from the results.`;

/** Full system prompt, optionally including web-search instructions when Tavily is enabled. */
export function buildChatSystemMessage(options?: {
  webSearchEnabled?: boolean;
}): SystemMessage {
  const base = MIII_SYSTEM_PROMPT;
  const text =
    options?.webSearchEnabled === true ? base + WEB_SEARCH_SUFFIX : base;
  return new SystemMessage(text);
}

export type ChatMessageJSON = {
  role: "user" | "assistant" | "system";
  content: string;
};

export function jsonToMessages(rows: ChatMessageJSON[]): BaseMessage[] {
  return rows.map((row) => {
    switch (row.role) {
      case "assistant":
        return new AIMessage(row.content);
      case "system":
        return new SystemMessage(row.content);
      default:
        return new HumanMessage(row.content);
    }
  });
}

export function messageContentToString(msg: BaseMessage): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return String(c ?? "");
}
