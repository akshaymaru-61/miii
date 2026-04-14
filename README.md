# Miii

Local-first chat UI that talks to **[Ollama](https://ollama.com)** through **[LangGraph](https://langchain-ai.github.io/langgraphjs/)**, with streamed replies and Markdown rendering. Built with [Next.js](https://nextjs.org) (App Router), React 19, Tailwind CSS 4, and UI primitives.

**Author:** AKSHAY MARU

## Features

- **Model picker** — Lists tags from your local Ollama server (`/api/models`).
- **Streaming assistant responses** — NDJSON over `/api/chat` (`application/x-ndjson`).
- **Markdown in messages** — GFM via `react-markdown` + `remark-gfm`.
- **Miii persona** — Server-side system prompt in `lib/messages.ts` (personality + precision for work).
- **Conversations** — Multiple chats with titles derived from the first user message; state persisted in the browser (`localStorage`, see `lib/conversation-storage.ts`).
- **Optional web search** — When enabled, the model can call **`tavily_web_search`** ([Tavily](https://tavily.com)) for live results. Requires a Tavily API key (browser storage in the app and/or `TAVILY_API_KEY` on the server).
- **Custom skills (tools)** — JSON definitions under `customTools/` are loaded as LangChain tools; manage them via `/api/custom-tools` and the in-app dialogs (or slash commands — see below). Default execution is a **placeholder**; extend `skillToolFromDefinition` in `lib/custom-tools.ts` for real behavior.
- **LangGraph routing** — With no tools, the app streams directly from Ollama. When custom skills and/or Tavily are active, a LangGraph agent runs (`agent` → `tools` loop, `streamMode: "messages"`).
- **Terminal UI (TUI)** — [OpenClaw](https://docs.openclaw.ai/tui)-style CLI: header (URL, model, web-search flag, status), transcript, and input. Runs against the same HTTP API as the browser (default base `http://127.0.0.1:3000`). See [Terminal UI](#terminal-ui) below.

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Ollama](https://ollama.com) installed and running, with at least one model pulled (for example `ollama pull llama3.2`)

## Configuration

Environment variables (optional unless noted):

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama API base URL (default: `http://127.0.0.1:11434`) |
| `TAVILY_API_KEY` | Tavily API key for web search when the UI requests search and no client key is sent |
| `MIIIBOT_URL` | Base URL for the TUI client (default: `http://127.0.0.1:3000`) |

Set values in `.env.local` as needed. For web search you can also save a key in the app (stored locally in the browser). The TUI reads `TAVILY_API_KEY` from the environment of the **shell** that launches it and sends it in the chat request body (same as the web UI’s stored key).

### Terminal UI

With the app running (`npm run dev` or `npm run start`), open another terminal:

```bash
npm run tui
```

Defaults to **`http://127.0.0.1:3000`**. Override with:

```bash
MIIIBOT_URL=http://127.0.0.1:3000 npm run tui
npm run tui -- --url http://127.0.0.1:3000
```

Use `/help` inside the TUI for commands (`/model`, `/url`, `/web on|off`, `/clear`, `/quit`). Source: `scripts/miii-tui.tsx` ([Ink](https://github.com/vadimdemedes/ink)); `npm run tui` bundles it with **esbuild** to ESM (`scripts/.tui-bundle.mjs`, gitignored) so Node loads Ink’s `yoga-layout` dependency correctly (the old `tsx`-only runner could fail with “Top-level await is currently not supported with the cjs output format”).

Run the TUI in a **real interactive terminal** (not a pipe or some IDE panels); Ink needs stdin raw mode.

## Getting started

### One-line install (curl · global `miii`)

After you push this repo to GitHub, others can install the CLI like [OpenClaw](https://docs.openclaw.ai/install) (clones to `~/.miii/checkout`, runs `npm install`, then `npm install -g .`):

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/maruakshay/miii/main/scripts/install.sh | bash
```

- **Fork or different repo:** `curl ... | env MIII_REPO_URL=https://github.com/you/miibot.git bash -s` (or change the default `MIII_REPO_URL` in `scripts/install.sh`).
- **Dry run:** `curl ... | bash -s -- --dry-run`
- Requires **Git**, **Node.js 20+**, and **npm** on `PATH`.

### From a clone

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run tui` | Terminal UI (requires dev/prod server on the configured base URL) |

## Slash commands (composer)

Type `/` at the start of a line for suggestions, including:

- `/clear` — Clear the current conversation
- `/clear all` — Remove all saved conversations
- `/tools` — Add a custom skill (opens dialog)
- `/delete-tool` — Delete a saved skill
- `/web` — Open the Tavily / web search dialog (API key and toggling search)

There is also a **Web search** entry in the slash menu and a globe control in the UI to turn search on or off.

## Project layout (high level)

| Path | Role |
|------|------|
| `app/api/chat` | POST: stream chat; body includes `model`, `messages`, optional `webSearch`, optional `tavilyApiKey` |
| `app/api/models` | Lists Ollama models |
| `app/api/custom-tools` | GET/POST/DELETE — list, create, delete skill JSON on disk |
| `lib/chat-graph.ts` | `ChatOllama`, LangGraph compile, `streamChatTokens` |
| `lib/chat-tools.ts` | Merges custom disk tools + optional Tavily; `resolveTavilyApiKey` |
| `lib/custom-tools.ts` | `customTools/*.json` I/O and LangChain tool stubs |
| `lib/tavily-tool.ts` | Tavily search tool implementation |
| `lib/messages.ts` | System prompt builders and JSON ↔ LangChain messages |
| `lib/conversation-storage.ts` | Client-side conversation persistence types and helpers |
| `customTools/` | One JSON file per skill (`name`, `description`, `createdAt`) |
| `components/chat/` | Chat UI, Markdown, skill/Tavily dialogs |
| `scripts/miii-tui.tsx` | Ink TUI client for `/api/chat` + `/api/models` |

Typography uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts): **Inter** (sans) and **Geist Mono**. For deployment, see the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying). Long-running chat requests use `maxDuration` on the chat route; configure your host accordingly if you deploy serverlessly.
