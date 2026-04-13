import { promises as fs } from "fs";
import path from "path";

import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

export type CustomToolDefinition = {
  name: string;
  description: string;
  createdAt: string;
};

const DIR = path.join(process.cwd(), "customTools");

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

function safeFileBase(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function validateToolName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Name is required";
  if (!NAME_RE.test(t)) {
    return "Use letters, numbers, underscore; start with a letter or _. Max 64 chars.";
  }
  return null;
}

export async function ensureCustomToolsDir(): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
}

export async function listCustomToolDefinitions(): Promise<
  CustomToolDefinition[]
> {
  let names: string[];
  try {
    names = await fs.readdir(DIR);
  } catch {
    return [];
  }
  const out: CustomToolDefinition[] = [];
  for (const entName of names) {
    if (!entName.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DIR, entName), "utf8");
      const parsed = JSON.parse(raw) as CustomToolDefinition;
      if (
        typeof parsed.name === "string" &&
        typeof parsed.description === "string"
      ) {
        out.push({
          name: parsed.name,
          description: parsed.description,
          createdAt:
            typeof parsed.createdAt === "string"
              ? parsed.createdAt
              : new Date().toISOString(),
        });
      }
    } catch {
      /* skip invalid */
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function saveCustomToolDefinition(
  def: Pick<CustomToolDefinition, "name" | "description">,
): Promise<void> {
  const err = validateToolName(def.name);
  if (err) throw new Error(err);
  const description = def.description.trim();
  if (!description) throw new Error("Description is required");

  await ensureCustomToolsDir();
  const fileBase = safeFileBase(def.name.trim());
  const full: CustomToolDefinition = {
    name: def.name.trim(),
    description,
    createdAt: new Date().toISOString(),
  };
  const fp = path.join(DIR, `${fileBase}.json`);
  await fs.writeFile(fp, JSON.stringify(full, null, 2), "utf8");
}

/** Removes a skill JSON file by tool name. */
export async function deleteCustomToolDefinition(name: string): Promise<void> {
  const err = validateToolName(name);
  if (err) throw new Error(err);
  const fileBase = safeFileBase(name.trim());
  const fp = path.join(DIR, `${fileBase}.json`);
  try {
    await fs.unlink(fp);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "ENOENT") {
      throw new Error("Tool not found");
    }
    throw e;
  }
}

/** LangChain tools built from saved JSON skills (placeholder execution; extend per skill in code if needed). */
export async function loadCustomToolsFromDisk(): Promise<
  StructuredToolInterface[]
> {
  const defs = await listCustomToolDefinitions();
  return defs.map(skillToolFromDefinition);
}

function skillToolFromDefinition(
  def: CustomToolDefinition,
): StructuredToolInterface {
  return tool(
    async (input: { query: string }) => {
      return JSON.stringify(
        {
          skill: def.name,
          about: def.description,
          query: input.query,
          note: "Placeholder result. Wire real behavior in lib/custom-tools.ts (skillToolFromDefinition) or a server module.",
        },
        null,
        2,
      );
    },
    {
      name: def.name,
      description: def.description,
      schema: z.object({
        query: z
          .string()
          .describe(
            "What to do with this skill, derived from the user’s request.",
          ),
      }),
    },
  ) as unknown as StructuredToolInterface;
}
