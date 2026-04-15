# Miii
![miii logo](public/miii.png)
![miii web](public/ss1.png)
![miii terminal](public/ss2.png)

> A local-first AI chat UI built to **simplify running LLMs locally** — with minimal setup and seamless usage.

miii is designed to **ease the installation and usage process**, eliminating the friction seen in tools like OpenClaw. With just a few integrations, it runs effortlessly via both a **Web UI and terminal**.

It talks to **[Ollama](https://ollama.com)** through **[LangGraph](https://langchain-ai.github.io/langgraphjs/)**, with streamed replies and Markdown rendering. Built with [Next.js](https://nextjs.org) (App Router), React 19, Tailwind CSS 4, and UI primitives.

**Author:** Akshay Maru


## Why miii?

Most local LLM tools require **complex setup, multiple dependencies, and fragmented workflows**.

miii solves this by providing:

- ⚡ **Minimal setup** — get started in minutes
- 🔌 **Few integrations** — no heavy configuration
- 🖥️ **Dual interface** — Web UI + Terminal (TUI)
- 🧠 **Local-first architecture** — privacy-focused by default
- 🚀 **Smooth developer experience** — streaming + Markdown out of the box

## Features

- **Model picker** — Lists tags from your local Ollama server (`/api/models`).
- **Streaming assistant responses** — NDJSON over `/api/chat` (`application/x-ndjson`).
- **Markdown in messages** — GFM via `react-markdown` + `remark-gfm`.
- **Miii persona** — Server-side system prompt in `lib/messages.ts` (personality + precision for work).
- **Conversations** — Multiple chats with titles derived from the first user message; state persisted in the browser (`localStorage`, see `lib/conversation-storage.ts`).
- **Optional web search** — When enabled, the model can call **`tavily_web_search`** ([Tavily](https://tavily.com)) for live results. Requires a Tavily API key (browser storage in the app and/or `TAVILY_API_KEY` on the server).
- **Custom skills (tools)** — JSON definitions under `customTools/` are loaded as LangChain tools; manage them via `/api/custom-tools` and the in-app dialogs (or slash commands — see below). Default execution is a **placeholder**; extend `skillToolFromDefinition` in `lib/custom-tools.ts` for real behavior.
- **LangGraph routing** — With no tools, the app streams directly from Ollama. When custom skills and/or Tavily are active, a LangGraph agent runs (`agent` → `tools` loop, `streamMode: "messages"`).
- **Terminal UI (TUI)** — OpenClaw-style CLI: header (URL, model, web-search flag, status), transcript, and input. Runs against the same HTTP API as the browser (default base `http://127.0.0.1:3000`). See [Terminal UI](#terminal-ui) below.

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

## Terminal UI

With the app running (`npm run dev` or `npm run start`), open another terminal:

```bash
npm run tui
````

Defaults to **`http://127.0.0.1:3000`**. Override with:

```bash
MIIIBOT_URL=http://127.0.0.1:3000 npm run tui
npm run tui -- --url http://127.0.0.1:3000
```

Use `/help` inside the TUI for commands (`/model`, `/url`, `/web on|off`, `/clear`, `/quit`). Source: `scripts/miii-tui.tsx` (Ink); `npm run tui` bundles it with **esbuild** to ESM (`scripts/.tui-bundle.mjs`, gitignored).

Run the TUI in a **real interactive terminal** (not a pipe or some IDE panels); Ink needs stdin raw mode.

## Getting started

### One-line install (curl · global `miii`)

After you push this repo to GitHub:

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/maruakshay/miii/main/scripts/install.sh | bash
```

* Fork/different repo:

```bash
curl ... | env MIII_REPO_URL=https://github.com/you/miibot.git bash -s
```

* Dry run:

```bash
curl ... | bash -s -- --dry-run
```

Requires **Git**, **Node.js 20+**, and **npm**.

### From a clone

```bash
npm install
npm run dev
```

---

## Scripts

| Command         | Description           |
| --------------- | --------------------- |
| `npm run dev`   | Development server    |
| `npm run build` | Production build      |
| `npm run start` | Run production server |
| `npm run lint`  | ESLint                |
| `npm run tui`   | Terminal UI           |



## Slash commands

* `/clear`
* `/clear all`
* `/tools`
* `/delete-tool`
* `/web`

## Project layout (high level)

| Path                          | Role               |
| ----------------------------- | ------------------ |
| `app/api/chat`                | Stream chat        |
| `app/api/models`              | List models        |
| `app/api/custom-tools`        | Manage tools       |
| `lib/chat-graph.ts`           | LangGraph logic    |
| `lib/chat-tools.ts`           | Tool merging       |
| `lib/custom-tools.ts`         | Tool definitions   |
| `lib/tavily-tool.ts`          | Tavily integration |
| `lib/messages.ts`             | System prompts     |
| `lib/conversation-storage.ts` | Local storage      |
| `customTools/`                | JSON tools         |
| `components/chat/`            | UI                 |
| `scripts/miii-tui.tsx`        | TUI                |
