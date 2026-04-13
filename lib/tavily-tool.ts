import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

/** LangChain tool: Tavily web search (requires a valid API key per request). */
export function createTavilyWebSearchTool(
  apiKey: string,
): StructuredToolInterface {
  const key = apiKey.trim();
  return tool(
    async (input: { query: string }) => {
      const query = input.query.trim();
      if (!query) {
        return JSON.stringify({ error: "Empty search query." });
      }
      const res = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          include_answer: true,
          max_results: 6,
        }),
      });
      const rawText = await res.text();
      if (!res.ok) {
        return JSON.stringify({
          error: `Tavily HTTP ${res.status}`,
          detail: rawText.slice(0, 800),
        });
      }
      let data: unknown;
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        return JSON.stringify({
          error: "Invalid JSON from Tavily",
          detail: rawText.slice(0, 400),
        });
      }
      const d = data as {
        answer?: string;
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const payload = {
        answer: d.answer ?? null,
        results: (d.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet:
            typeof r.content === "string" ? r.content.slice(0, 600) : undefined,
        })),
      };
      return JSON.stringify(payload, null, 2);
    },
    {
      name: "tavily_web_search",
      description:
        "Search the live web via Tavily for recent news, current facts, prices, sports, or anything needing up-to-date sources. Use when the user asks for information that may have changed or is not in your training data.",
      schema: z.object({
        query: z
          .string()
          .describe("Focused search query; include topic, year, or entity names when helpful."),
      }),
    },
  ) as unknown as StructuredToolInterface;
}
