/**
 * OpenClaw-inspired terminal UI: connects to the local Miii Next.js app (default http://127.0.0.1:3000).
 *
 * Usage:
 *   npm run dev   # in another terminal
 *   npm run tui
 *
 *   MIIIBOT_URL=http://127.0.0.1:3000 npm run tui
 *   npm run tui -- --url http://127.0.0.1:3000
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Spacer, Text, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import { render } from "ink";

type ChatRow = { role: "user" | "assistant" | "system"; text: string };

type NdLine =
  | { type: "token"; t: string }
  | { type: "done" }
  | { type: "error"; message: string };

function parseArgs(argv: string[]): { url: string } {
  const envUrl = process.env.MIIIBOT_URL?.trim();
  let url = envUrl || "http://127.0.0.1:3000";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      url = argv[i + 1];
      i++;
    }
  }
  return { url: url.replace(/\/$/, "") };
}

async function fetchModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/models`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json()) as { models?: string[] };
  return data.models ?? [];
}

async function streamChat(
  baseUrl: string,
  payload: {
    model: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    webSearch: boolean;
    tavilyApiKey: string;
  },
  onToken: (t: string) => void,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      msg = j.message ?? j.error ?? msg;
    } catch {
      try {
        msg = (await res.text()) || msg;
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const dec = new TextDecoder();
  let carry = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const parts = carry.split("\n");
    carry = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.trim()) continue;
      let obj: NdLine;
      try {
        obj = JSON.parse(line) as NdLine;
      } catch {
        continue;
      }
      if (obj.type === "token" && obj.t) onToken(obj.t);
      if (obj.type === "error") throw new Error(obj.message || "Chat error");
    }
  }
  if (carry.trim()) {
    try {
      const obj = JSON.parse(carry) as NdLine;
      if (obj.type === "token" && obj.t) onToken(obj.t);
      if (obj.type === "error") throw new Error(obj.message || "Chat error");
    } catch (e) {
      if (e instanceof SyntaxError) return;
      throw e;
    }
  }
}

/** Word-wrap plain text to a maximum line width (preserves blank lines between paragraphs). */
function wrapPlainText(text: string, maxWidth: number): string[] {
  if (maxWidth < 4) return text.split("\n");
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxWidth) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      if (word.length <= maxWidth) {
        line = word;
        continue;
      }
      let rest = word;
      while (rest.length > maxWidth) {
        out.push(rest.slice(0, maxWidth));
        rest = rest.slice(maxWidth);
      }
      line = rest;
    }
    if (line) out.push(line);
  }
  return out;
}

type VisibleBubble = {
  key: string;
  role: ChatRow["role"];
  lines: string[];
};

function bubbleRowBudget(lineCount: number, role: ChatRow["role"]): number {
  if (role === "system") return Math.max(1, lineCount);
  return lineCount + 4;
}

function buildVisibleBubbles(
  rows: ChatRow[],
  innerWidth: number,
  maxTotalRows: number,
): { bubbles: VisibleBubble[]; truncated: boolean } {
  const bubbles: VisibleBubble[] = [];
  let used = 0;
  let truncated = false;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const wrapped = wrapPlainText(row.text, innerWidth);
    const cost = bubbleRowBudget(wrapped.length, row.role);
    if (used + cost > maxTotalRows && bubbles.length > 0) {
      truncated = true;
      break;
    }
    bubbles.unshift({
      key: `m-${i}-${row.role}`,
      role: row.role,
      lines: wrapped,
    });
    used += cost;
  }

  return { bubbles, truncated };
}

function App({ initialUrl }: { initialUrl: string }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const termCols = stdout?.columns ?? 80;

  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsHint, setModelsHint] = useState<string | null>(null);
  const [rowsState, setRowsState] = useState<ChatRow[]>([
    {
      role: "system",
      text: "Miii TUI — /help for commands. Ensure `npm run dev` is running.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchModels(baseUrl);
        if (cancelled) return;
        setModels(list);
        if (list.length) setModel((m) => m || list[0]!);
        setModelsHint(
          list.length
            ? null
            : "No models from Ollama — set one with /model <name>",
        );
      } catch (e) {
        if (cancelled) return;
        setModelsHint(
          e instanceof Error ? e.message : "Could not reach /api/models",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const transcriptHeight = Math.max(8, termRows - 10);
  const bubbleOuterWidth = Math.min(76, Math.max(28, termCols - 10));
  const innerWrapWidth = Math.max(16, bubbleOuterWidth - 6);

  const { bubbles, truncated } = useMemo(
    () => buildVisibleBubbles(rowsState, innerWrapWidth, transcriptHeight),
    [rowsState, innerWrapWidth, transcriptHeight],
  );

  const lastRow = rowsState[rowsState.length - 1];
  const streamingAssistant = busy && lastRow?.role === "assistant";

  const pushSystem = useCallback((text: string) => {
    setRowsState((prev) => [...prev, { role: "system", text }]);
  }, []);

  const runChat = useCallback(
    async (userText: string) => {
      const m = model.trim();
      if (!m) {
        pushSystem("Set a model first: /model <ollama-model>");
        return;
      }
      setBusy(true);
      const history = rowsState.filter(
        (r) => r.role === "user" || r.role === "assistant",
      );
      const messages = [
        ...history.map((r) => ({
          role: r.role as "user" | "assistant",
          content: r.text,
        })),
        { role: "user" as const, content: userText },
      ];

      setRowsState((prev) => [
        ...prev,
        { role: "user", text: userText },
        { role: "assistant", text: "" },
      ]);

      const tavilyKey = process.env.TAVILY_API_KEY?.trim() ?? "";

      try {
        await streamChat(
          baseUrl,
          {
            model: m,
            messages,
            webSearch,
            tavilyApiKey: tavilyKey,
          },
          (t) => {
            setRowsState((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  role: "assistant",
                  text: last.text + t,
                };
              }
              return next;
            });
          },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRowsState((prev) => {
          const next = [...prev];
          if (
            next[next.length - 1]?.role === "assistant" &&
            !next[next.length - 1].text
          ) {
            next.pop();
          }
          return [...next, { role: "system", text: `Error: ${msg}` }];
        });
      } finally {
        setBusy(false);
      }
    },
    [baseUrl, model, rowsState, webSearch, pushSystem],
  );

  const handleSubmit = useCallback(
    (value: string) => {
      const text = value.trim();
      setInput("");
      if (!text) return;

      if (text === "/help" || text === "/?") {
        pushSystem(
          [
            "/help /? — this help",
            "/quit /exit — leave",
            "/clear — clear transcript",
            "/models — refresh model list from API",
            "/model — show current model",
            "/model <name> — set Ollama model tag",
            `/url <base> — API base (default ${initialUrl})`,
            "/web on|off — toggle Tavily web search (needs TAVILY_API_KEY on server or in env)",
            "—",
            "Env: MIIIBOT_URL, TAVILY_API_KEY",
          ].join("\n"),
        );
        return;
      }
      if (text === "/quit" || text === "/exit") {
        exit();
        return;
      }
      if (text === "/clear") {
        setRowsState([{ role: "system", text: "Transcript cleared." }]);
        return;
      }
      if (text === "/models") {
        void (async () => {
          try {
            const list = await fetchModels(baseUrl);
            setModels(list);
            if (list.length && !model) setModel(list[0]);
            pushSystem(
              list.length ? list.join(", ") : "(empty — check Ollama)",
            );
          } catch (e) {
            pushSystem(e instanceof Error ? e.message : String(e));
          }
        })();
        return;
      }
      if (text.startsWith("/model")) {
        const rest = text.slice("/model".length).trim();
        if (!rest) {
          pushSystem(`Model: ${model || "(none)"}`);
          return;
        }
        setModel(rest);
        pushSystem(`Model set to ${rest}`);
        return;
      }
      if (text.startsWith("/url")) {
        const rest = text.slice("/url".length).trim().replace(/\/$/, "");
        if (!rest) {
          pushSystem(`URL: ${baseUrl}`);
          return;
        }
        setBaseUrl(rest);
        pushSystem(`URL set to ${rest} (re-fetching models…)`);
        return;
      }
      if (text === "/web on") {
        setWebSearch(true);
        pushSystem(
          "Web search ON (requires Tavily key on server or TAVILY_API_KEY).",
        );
        return;
      }
      if (text === "/web off") {
        setWebSearch(false);
        pushSystem("Web search OFF.");
        return;
      }

      if (busy) {
        pushSystem("Wait for the current reply to finish.");
        return;
      }
      void runChat(text);
    },
    [baseUrl, busy, exit, initialUrl, model, pushSystem, runChat],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="magenta"
        paddingX={1}
        marginBottom={1}
      >
        <Text>
          <Text color="magenta" bold>
            Miii TUI
          </Text>
          <Text dimColor> · </Text>
          <Text color="cyan">{baseUrl}</Text>
          <Text dimColor> · </Text>
          <Text dimColor>
            {models.length ? `${models.length} tags · ` : ""}
          </Text>
          <Text>model </Text>
          <Text color="green">{model || "—"}</Text>
          <Text dimColor> · </Text>
          <Text>web </Text>
          <Text color={webSearch ? "yellow" : "gray"}>
            {webSearch ? "on" : "off"}
          </Text>
          <Text dimColor> · </Text>
          <Text dimColor>{busy ? "streaming…" : "idle"}</Text>
        </Text>
      </Box>

      {modelsHint ? (
        <Box
          marginBottom={1}
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
        >
          <Text color="yellow">{modelsHint}</Text>
        </Box>
      ) : null}

      <Box
        flexDirection="column"
        flexGrow={1}
        marginBottom={1}
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={1}
      >
        {truncated ? (
          <Box marginBottom={1}>
            <Text dimColor italic>
              ▲ Older messages not shown — widen/tall terminal or /clear
            </Text>
          </Box>
        ) : null}
        {bubbles.map((bubble, bi) => {
          const isLastBubble = bi === bubbles.length - 1;
          const showCaret =
            isLastBubble && bubble.role === "assistant" && streamingAssistant;

          if (bubble.role === "system") {
            return (
              <Box key={bubble.key} marginBottom={1} flexDirection="column">
                {bubble.lines.map((ln, j) => (
                  <Text key={`${bubble.key}-l${j}`} dimColor color="yellow">
                    {ln ? `▸ ${ln}` : " "}
                  </Text>
                ))}
              </Box>
            );
          }

          if (bubble.role === "user") {
            return (
              <Box key={bubble.key} flexDirection="row" marginBottom={1}>
                <Spacer />
                <Box
                  borderStyle="round"
                  borderColor="cyan"
                  paddingX={1}
                  width={bubbleOuterWidth}
                >
                  <Box flexDirection="column">
                    <Text bold color="cyan">
                      You
                    </Text>
                    {bubble.lines.map((ln, j) => (
                      <Text key={`${bubble.key}-l${j}`} color="white">
                        {ln}
                      </Text>
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          }

          return (
            <Box key={bubble.key} flexDirection="row" marginBottom={1}>
              <Box
                borderStyle="round"
                borderColor="green"
                paddingX={1}
                width={bubbleOuterWidth}
              >
                <Box flexDirection="column">
                  <Text bold color="green">
                    Miii
                  </Text>
                  {bubble.lines.length === 0 && showCaret ? (
                    <Text color="white">
                      <Text dimColor>▌</Text>
                    </Text>
                  ) : (
                    bubble.lines.map((ln, j) => {
                      const last = j === bubble.lines.length - 1;
                      return (
                        <Text key={`${bubble.key}-l${j}`} color="white">
                          {ln}
                          {last && showCaret ? <Text dimColor> ▌</Text> : null}
                        </Text>
                      );
                    })
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
        <Text color="cyan">{busy ? "… " : "› "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Message or /help"
        />
      </Box>
    </Box>
  );
}

const { url } = parseArgs(process.argv.slice(2));
render(<App initialUrl={url} />);
