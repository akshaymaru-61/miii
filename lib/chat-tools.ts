import type { StructuredToolInterface } from "@langchain/core/tools";

import { loadCustomToolsFromDisk } from "@/lib/custom-tools";
import { createTavilyWebSearchTool } from "@/lib/tavily-tool";

/** Resolves Tavily API key: explicit client value, else server env. */
export function resolveTavilyApiKey(clientKey?: string | null): string | null {
  const fromClient = clientKey?.trim();
  if (fromClient) return fromClient;
  const fromEnv = process.env.TAVILY_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return null;
}

export type LoadChatToolsOptions = {
  /** When true, attach Tavily if an API key can be resolved (client or \`TAVILY_API_KEY\`). */
  webSearchRequested: boolean;
  tavilyApiKey?: string | null;
};

/** Custom skills from disk plus optional Tavily when web search is requested and a key exists. */
export async function loadAllChatTools(
  options: LoadChatToolsOptions,
): Promise<StructuredToolInterface[]> {
  const custom = await loadCustomToolsFromDisk();
  if (!options.webSearchRequested) {
    return custom;
  }
  const key = resolveTavilyApiKey(options.tavilyApiKey);
  if (!key) {
    return custom;
  }
  return [...custom, createTavilyWebSearchTool(key)];
}
