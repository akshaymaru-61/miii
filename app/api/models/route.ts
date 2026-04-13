import { NextResponse } from "next/server";

import { getOllamaBaseUrl } from "@/lib/ollama";

export async function GET() {
  const base = getOllamaBaseUrl();
  try {
    const res = await fetch(`${base}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Ollama returned ${res.status}`, models: [] },
        { status: 502 }
      );
    }
    const data = (await res.json()) as {
      models?: { name: string }[];
    };
    const models = (data.models ?? []).map((m) => m.name);
    return NextResponse.json({ models });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reach Ollama";
    return NextResponse.json({ error: message, models: [] }, { status: 503 });
  }
}
