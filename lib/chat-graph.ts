import {
  AIMessage,
  AIMessageChunk,
  type AIMessageChunk as AIMessageChunkType,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

import { loadAllChatTools } from "@/lib/chat-tools";
import { getOllamaBaseUrl } from "@/lib/ollama";

import type { StructuredToolInterface } from "@langchain/core/tools";

export function createOllamaChat(model: string, streaming: boolean) {
  return new ChatOllama({
    model,
    baseUrl: getOllamaBaseUrl(),
    temperature: 0.7,
    streaming,
  });
}

function chunkToDelta(chunk: AIMessageChunkType): string {
  const c = chunk.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    let s = "";
    for (const part of c) {
      if (typeof part === "string") s += part;
      else if (part && typeof part === "object" && "text" in part) {
        s += String((part as { text?: string }).text ?? "");
      }
    }
    return s;
  }
  return "";
}

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  model: Annotation<string>(),
});

function compileGraph(tools: StructuredToolInterface[]) {
  if (tools.length === 0) {
    return new StateGraph(GraphState)
      .addNode("chat", async (state: typeof GraphState.State) => {
        const llm = createOllamaChat(state.model, false);
        const response = await llm.invoke(state.messages);
        return { messages: [response] };
      })
      .addEdge(START, "chat")
      .addEdge("chat", END)
      .compile();
  }

  const toolNode = new ToolNode(tools);
  return new StateGraph(GraphState)
    .addNode("agent", async (state: typeof GraphState.State) => {
      const llm = createOllamaChat(state.model, true).bindTools(tools);
      const stream = await llm.stream(state.messages);
      let gathered: AIMessageChunk | undefined;
      for await (const chunk of stream) {
        if (AIMessageChunk.isInstance(chunk)) {
          gathered = gathered ? gathered.concat(chunk) : chunk;
        }
      }
      if (!gathered) {
        return { messages: [] };
      }
      const response = new AIMessage({
        content: gathered.content,
        tool_calls: gathered.tool_calls,
        invalid_tool_calls: gathered.invalid_tool_calls,
        usage_metadata: gathered.usage_metadata,
        id: gathered.id,
        response_metadata: gathered.response_metadata,
        additional_kwargs: gathered.additional_kwargs,
      });
      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", END])
    .addEdge("tools", "agent")
    .compile();
}

export type StreamChatOptions = {
  /** User turned on web search in the UI. */
  webSearch?: boolean;
  /** Optional Tavily API key from the client; falls back to \`TAVILY_API_KEY\` env on the server. */
  tavilyApiKey?: string | null;
};

/** Token stream for the API: streams LLM tokens (direct chat or agent+tools via LangGraph message stream). */
export async function* streamChatTokens(
  messages: BaseMessage[],
  model: string,
  options?: StreamChatOptions,
): AsyncGenerator<string, void, undefined> {
  const tools = await loadAllChatTools({
    webSearchRequested: options?.webSearch === true,
    tavilyApiKey: options?.tavilyApiKey,
  });
  const graph = compileGraph(tools);

  if (tools.length === 0) {
    const llm = createOllamaChat(model.trim(), true);
    const stream = await llm.stream(messages);
    for await (const chunk of stream) {
      const delta = chunkToDelta(chunk as AIMessageChunk);
      if (delta) yield delta;
    }
    return;
  }

  const graphStream = await graph.stream(
    { messages, model: model.trim() },
    { recursionLimit: 25, streamMode: "messages" },
  );

  for await (const part of graphStream) {
    if (!Array.isArray(part) || part.length < 1) continue;
    const msg = part[0] as BaseMessage;
    if (!AIMessage.isInstance(msg) && !AIMessageChunk.isInstance(msg)) {
      continue;
    }
    const delta = chunkToDelta(msg as AIMessageChunk);
    if (delta) yield delta;
  }
}

export const chatGraph = compileGraph([]);
