import { NextResponse } from "next/server";

import {
  deleteCustomToolDefinition,
  listCustomToolDefinitions,
  saveCustomToolDefinition,
  validateToolName,
} from "@/lib/custom-tools";

export async function GET() {
  try {
    const tools = await listCustomToolDefinitions();
    return NextResponse.json({ tools });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list tools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { name?: unknown }).name !== "string" ||
    typeof (body as { description?: unknown }).description !== "string"
  ) {
    return NextResponse.json(
      { error: "Expected { name: string, description: string }" },
      { status: 400 },
    );
  }

  const nameErr = validateToolName((body as { name: string }).name);
  if (nameErr) {
    return NextResponse.json({ error: nameErr }, { status: 400 });
  }

  try {
    await saveCustomToolDefinition({
      name: (body as { name: string }).name,
      description: (body as { description: string }).description,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save tool";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const rawName = url.searchParams.get("name");
  if (!rawName?.trim()) {
    return NextResponse.json(
      { error: 'Query "name" is required' },
      { status: 400 },
    );
  }
  const nameErr = validateToolName(rawName);
  if (nameErr) {
    return NextResponse.json({ error: nameErr }, { status: 400 });
  }
  try {
    await deleteCustomToolDefinition(rawName);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete tool";
    const status = message === "Tool not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
