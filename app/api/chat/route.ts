import { NextResponse } from "next/server";

import { streamChatTokens } from "@/lib/chat-graph";
import {
  buildChatSystemMessage,
  jsonToMessages,
  type ChatMessageJSON,
} from "@/lib/messages";
import { resolveTavilyApiKey } from "@/lib/chat-tools";

export const maxDuration = 120;

type NdLine =
  | { type: "token"; t: string }
  | { type: "done" }
  | { type: "error"; message: string };

function ndjsonLine(obj: NdLine): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model =
    typeof body === "object" &&
    body !== null &&
    "model" in body &&
    typeof (body as { model: unknown }).model === "string"
      ? (body as { model: string }).model
      : null;

  const rawMessages =
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray((body as { messages: unknown }).messages)
      ? (body as { messages: ChatMessageJSON[] }).messages
      : null;

  const wantWebSearch =
    typeof body === "object" &&
    body !== null &&
    "webSearch" in body &&
    (body as { webSearch?: unknown }).webSearch === true;

  const clientTavilyKey =
    typeof body === "object" &&
    body !== null &&
    "tavilyApiKey" in body &&
    typeof (body as { tavilyApiKey?: unknown }).tavilyApiKey === "string"
      ? (body as { tavilyApiKey: string }).tavilyApiKey
      : null;

  const resolvedTavilyKey = resolveTavilyApiKey(clientTavilyKey);

  if (wantWebSearch && !resolvedTavilyKey) {
    return NextResponse.json(
      {
        error: "TAVILY_KEY_REQUIRED",
        message:
          "Web search is on but no Tavily API key is configured. Add your key in the app or set TAVILY_API_KEY on the server.",
      },
      { status: 400 },
    );
  }

  if (!model?.trim()) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }
  if (!rawMessages?.length) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  for (const m of rawMessages) {
    if (
      !m ||
      typeof m !== "object" ||
      !["user", "assistant", "system"].includes(m.role) ||
      typeof m.content !== "string"
    ) {
      return NextResponse.json({ error: "Invalid message shape" }, { status: 400 });
    }
  }

  const webSearchEnabled = wantWebSearch && Boolean(resolvedTavilyKey);

  const messages = [
    buildChatSystemMessage({ webSearchEnabled }),
    ...jsonToMessages(rawMessages),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamChatTokens(messages, model.trim(), {
          webSearch: wantWebSearch,
          tavilyApiKey: clientTavilyKey,
        })) {
          controller.enqueue(ndjsonLine({ type: "token", t: delta }));
        }
        controller.enqueue(ndjsonLine({ type: "done" }));
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Chat failed";
        console.error(e);
        controller.enqueue(
          ndjsonLine({ type: "error", message }),
        );
        controller.enqueue(ndjsonLine({ type: "done" }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
