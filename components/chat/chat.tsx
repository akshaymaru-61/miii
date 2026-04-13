"use client";

import * as React from "react";
import {
  Globe,
  KeyRound,
  Loader2Icon,
  Menu,
  MessageSquarePlus,
  SendIcon,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AddSkillDialog } from "@/components/chat/add-skill-dialog";
import { DeleteSkillDialog } from "@/components/chat/delete-skill-dialog";
import { TavilyKeyDialog } from "@/components/chat/tavily-key-dialog";
import { MarkdownContent } from "@/components/chat/markdown-content";
import {
  createDefaultConversationsState,
  loadConversationsState,
  saveConversationsState,
  titleFromMessages,
  type StoredChatMessage,
  type StoredConversation,
} from "@/lib/conversation-storage";
import { cn } from "@/lib/utils";

function uid() {
  return crypto.randomUUID();
}

/** Space reserved for the fixed composer so the last message clears it */
const COMPOSER_GAP =
  "pb-[calc(9rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]";

const TAVILY_KEY_STORAGE = "miii.tavilyApiKey";
const WEB_SEARCH_STORAGE = "miii.webSearch";

const CMD_NO_MODEL = new Set([
  "/clear",
  "/clear all",
  "/tools",
  "/delete-tool",
  "/web",
]);

type SlashLineContext = {
  lineStart: number;
  lineEnd: number;
  query: string;
};

/** Current line starts with `/` and cursor is inside a slash token (start of line). */
function getSlashLineContext(
  value: string,
  cursorPos: number,
): SlashLineContext | null {
  if (cursorPos < 0 || cursorPos > value.length) return null;
  const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
  const lineEndIdx = value.indexOf("\n", cursorPos);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const rel = cursorPos - lineStart;
  const line = value.slice(lineStart, lineEnd);
  const before = line.slice(0, rel);
  if (!line.startsWith("/")) return null;
  if (!/^\/[\w-]*$/.test(before)) return null;
  return {
    lineStart,
    lineEnd,
    query: before.slice(1),
  };
}

type SlashAction = "addSkill" | "deleteSkill" | "tavily";

type SlashItem = {
  id: string;
  label: string;
  description: string;
  insert: string;
  action?: SlashAction;
};

const SLASH_ITEMS: SlashItem[] = [
  {
    id: "clear",
    label: "Clear chat",
    description: "Empty this conversation",
    insert: "/clear",
  },
  {
    id: "clear-all",
    label: "Clear all chats",
    description: "Remove every saved chat",
    insert: "/clear all",
  },
  {
    id: "add-tool",
    label: "Add tool",
    description: "Save a new custom skill",
    insert: "/tools",
    action: "addSkill",
  },
  {
    id: "delete-tool",
    label: "Delete tool",
    description: "Remove a saved skill file",
    insert: "/delete-tool",
    action: "deleteSkill",
  },
  {
    id: "web",
    label: "Web search",
    description: "Enable Tavily web search (API key)",
    insert: "",
    action: "tavily",
  },
];

export function Chat() {
  const [models, setModels] = React.useState<string[]>([]);
  const [model, setModel] = React.useState<string>("");
  const [conversations, setConversations] = React.useState<StoredConversation[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] =
    React.useState<string>("");
  const [hydrated, setHydrated] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loadingModels, setLoadingModels] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [skillDialogOpen, setSkillDialogOpen] = React.useState(false);
  const [deleteSkillDialogOpen, setDeleteSkillDialogOpen] =
    React.useState(false);
  const [tavilyDialogOpen, setTavilyDialogOpen] = React.useState(false);
  const [tavilyErrorHint, setTavilyErrorHint] = React.useState<string | null>(
    null,
  );
  const [webSearch, setWebSearch] = React.useState(false);
  const [tavilyApiKey, setTavilyApiKey] = React.useState("");
  const [cursorPos, setCursorPos] = React.useState(0);
  const [slashHighlight, setSlashHighlight] = React.useState(0);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const hasAppliedDefaultModel = React.useRef(false);

  const slashCtx = React.useMemo(
    () => getSlashLineContext(input, cursorPos),
    [input, cursorPos],
  );
  const slashMenuActive = slashCtx !== null;

  const slashFiltered = React.useMemo(() => {
    if (!slashCtx) return [];
    const q = slashCtx.query.toLowerCase();
    return SLASH_ITEMS.filter(
      (item) =>
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.insert.toLowerCase().includes(q),
    );
  }, [slashCtx]);

  React.useEffect(() => {
    setSlashHighlight(0);
  }, [slashCtx?.query, slashMenuActive, slashFiltered.length]);

  React.useEffect(() => {
    if (!slashMenuActive) return;
    function onMouseDown(ev: MouseEvent) {
      if (!(ev.target instanceof Node)) return;
      if (composerRef.current?.contains(ev.target)) return;
      setInput((prev) => {
        const ta = textareaRef.current;
        const pos = ta?.selectionStart ?? cursorPos;
        const ctx = getSlashLineContext(prev, pos);
        if (!ctx) return prev;
        return prev.slice(0, ctx.lineStart) + prev.slice(ctx.lineEnd);
      });
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [slashMenuActive, cursorPos]);

  React.useEffect(() => {
    const s = loadConversationsState();
    setConversations(s.conversations);
    setActiveConversationId(s.activeConversationId);
    try {
      setWebSearch(localStorage.getItem(WEB_SEARCH_STORAGE) === "1");
      setTavilyApiKey(localStorage.getItem(TAVILY_KEY_STORAGE) ?? "");
    } catch {
      /* private mode */
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WEB_SEARCH_STORAGE, webSearch ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [webSearch, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(TAVILY_KEY_STORAGE, tavilyApiKey);
    } catch {
      /* ignore */
    }
  }, [tavilyApiKey, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    saveConversationsState({
      version: 1,
      conversations,
      activeConversationId,
    });
  }, [conversations, activeConversationId, hydrated]);

  const messages = React.useMemo((): StoredChatMessage[] => {
    const c = conversations.find((x) => x.id === activeConversationId);
    return c?.messages ?? [];
  }, [conversations, activeConversationId]);

  const conversationsSorted = React.useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const updateActiveMessages = React.useCallback(
    (updater: React.SetStateAction<StoredChatMessage[]>) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversationId) return c;
          const next =
            typeof updater === "function" ? updater(c.messages) : updater;
          return {
            ...c,
            messages: next,
            updatedAt: Date.now(),
            title: titleFromMessages(next),
          };
        }),
      );
    },
    [activeConversationId],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingModels(true);
      setModelsError(null);
      try {
        const res = await fetch("/api/models");
        const data = (await res.json()) as {
          models?: string[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load models");
        }
        if (cancelled) return;
        const list = data.models ?? [];
        setModels(list);
        if (list.length && !hasAppliedDefaultModel.current) {
          hasAppliedDefaultModel.current = true;
          setModel(list[0]);
        }
      } catch (e) {
        if (!cancelled) {
          setModelsError(
            e instanceof Error ? e.message : "Failed to load models",
          );
        }
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  React.useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const applySlashItem = React.useCallback(
    (item: SlashItem, ctx: SlashLineContext) => {
      const before = input.slice(0, ctx.lineStart);
      const after = input.slice(ctx.lineEnd);
      const focusAt = (pos: number) => {
        requestAnimationFrame(() => {
          const ta = textareaRef.current;
          ta?.setSelectionRange(pos, pos);
          setCursorPos(pos);
        });
      };
      if (item.action === "addSkill") {
        setInput(before + after);
        setSkillDialogOpen(true);
        focusAt(before.length);
        return;
      }
      if (item.action === "deleteSkill") {
        setInput(before + after);
        setDeleteSkillDialogOpen(true);
        focusAt(before.length);
        return;
      }
      if (item.action === "tavily") {
        setInput(before + after);
        setTavilyDialogOpen(true);
        focusAt(before.length);
        return;
      }
      const next = before + item.insert + after;
      setInput(next);
      focusAt(ctx.lineStart + item.insert.length);
    },
    [input],
  );

  function newChat() {
    const id = uid();
    const fresh: StoredConversation = {
      id,
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((prev) => [fresh, ...prev]);
    setActiveConversationId(id);
    setSidebarOpen(false);
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
    setSidebarOpen(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    if (text === "/clear") {
      updateActiveMessages([]);
      setInput("");
      return;
    }

    if (text === "/clear all") {
      const s = createDefaultConversationsState();
      setConversations(s.conversations);
      setActiveConversationId(s.activeConversationId);
      setInput("");
      return;
    }

    if (text === "/tools") {
      setSkillDialogOpen(true);
      setInput("");
      return;
    }

    if (text === "/delete-tool") {
      setDeleteSkillDialogOpen(true);
      setInput("");
      return;
    }

    if (text === "/web") {
      setTavilyDialogOpen(true);
      setInput("");
      return;
    }

    if (!model) return;

    const userMsg: StoredChatMessage = { id: uid(), role: "user", content: text };
    const nextThread: StoredChatMessage[] = [...messages, userMsg];
    updateActiveMessages(nextThread);
    setInput("");
    setSending(true);

    const payload = {
      model,
      webSearch,
      tavilyApiKey,
      messages: nextThread.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    const assistantId = uid();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = "Request failed";
        try {
          const j = (await res.json()) as {
            error?: string;
            message?: string;
          };
          if (res.status === 400 && j.error === "TAVILY_KEY_REQUIRED") {
            setTavilyErrorHint(j.message ?? null);
            setTavilyDialogOpen(true);
            updateActiveMessages((prev) => prev.slice(0, -1));
            setInput(text);
            setSending(false);
            return;
          }
          errMsg = j.error ?? j.message ?? errMsg;
        } catch {
          errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      updateActiveMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const parsed = JSON.parse(line) as {
            type: string;
            t?: string;
            message?: string;
          };
          if (parsed.type === "token" && parsed.t) {
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + parsed.t }
                  : msg,
              ),
            );
          } else if (parsed.type === "error" && parsed.message) {
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content:
                        msg.content +
                        (msg.content ? "\n\n" : "") +
                        `Error: ${parsed.message}`,
                    }
                  : msg,
              ),
            );
          }
        }
        if (done) break;
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          const parsed = JSON.parse(tail) as { type: string; t?: string };
          if (parsed.type === "token" && parsed.t) {
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + parsed.t }
                  : msg,
              ),
            );
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Something went wrong";
      updateActiveMessages((prev) => {
        const hasSlot = prev.some((m) => m.id === assistantId);
        if (hasSlot) {
          return prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: msg.content
                    ? `${msg.content}\n\nError: ${err}`
                    : `Error: ${err}`,
                }
              : msg,
          );
        }
        return [
          ...prev,
          { id: uid(), role: "assistant", content: `Error: ${err}` },
        ];
      });
    } finally {
      setSending(false);
    }
  }

  const inputTrim = input.trim();
  const isCmdNoModel = CMD_NO_MODEL.has(inputTrim);
  const sendDisabled =
    sending ||
    !inputTrim ||
    (!model && !isCmdNoModel);

  return (
    <div className="flex min-h-0 flex-1">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 animate-in fade-in-0 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,100%)] flex-col border-[var(--chat-border)] bg-[var(--chat-sidebar)] transition-transform duration-200 ease-out md:static md:z-0 md:w-[260px] md:shrink-0 md:translate-x-0 md:border-r",
          sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--chat-border)] px-3 md:h-[3.25rem] md:px-3.5">
          <span className="truncate text-[17px] font-semibold tracking-tight text-[#2d2a20]">
            Miii
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-[#5c5748] hover:bg-black/[0.06] md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="shrink-0 px-3 pt-3 md:px-3.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-center gap-2 rounded-xl border-[var(--chat-border)] bg-[var(--chat-composer)] text-[13px] font-medium text-[#2d2a20] shadow-sm hover:bg-white"
            onClick={newChat}
            disabled={!hydrated || sending}
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 [-webkit-overflow-scrolling:touch]">
          {!hydrated ? (
            <p className="px-2 py-8 text-center text-[13px] text-[#8a8475]">
              Loading…
            </p>
          ) : conversationsSorted.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] leading-relaxed text-[#8a8475]">
              No chats yet. Start one to see it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5" role="list">
              {conversationsSorted.map((c) => {
                const active = c.id === activeConversationId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                        active
                          ? "bg-[#dcd8cc] text-[#1f1c17]"
                          : "text-[#3d3929] hover:bg-[var(--chat-sidebar-hover)]",
                        sending && "pointer-events-none opacity-60",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {c.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[var(--chat-border)] p-3">
          <Select
            value={model}
            onValueChange={(v) => {
              if (v) setModel(v);
            }}
            disabled={loadingModels || models.length === 0}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] text-[12px] font-medium text-[#2d2a20] shadow-none [&_svg]:text-[#5c5748]"
            >
              <SelectValue
                placeholder={loadingModels ? "Loading models…" : "Model"}
              />
            </SelectTrigger>
            <SelectContent className="border border-[var(--chat-border)] bg-[var(--chat-composer)] text-[#2d2a20]">
              {models.map((m) => (
                <SelectItem
                  key={m}
                  value={m}
                  className="text-[13px] focus:bg-[var(--chat-sidebar-hover)] data-highlighted:bg-[var(--chat-sidebar-hover)]"
                >
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={webSearch ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 min-w-0 flex-1 gap-1.5 rounded-lg text-[12px] font-medium",
                webSearch
                  ? "bg-[#2d6a4f] text-white hover:bg-[#245a42]"
                  : "border-[var(--chat-border)] bg-[var(--chat-composer)] text-[#2d2a20] hover:bg-white",
              )}
              disabled={!hydrated || sending}
              aria-pressed={webSearch}
              aria-label={
                webSearch
                  ? "Turn off Tavily web search"
                  : "Turn on Tavily web search"
              }
              title={
                webSearch
                  ? "Web search on — click to disable"
                  : "Web search off — click to configure Tavily"
              }
              onClick={() => {
                if (webSearch) {
                  setWebSearch(false);
                  return;
                }
                setTavilyDialogOpen(true);
              }}
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="truncate">Web</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] px-2.5 text-[#2d2a20] hover:bg-white"
              disabled={!hydrated || sending}
              aria-label="Tavily API key"
              title="Set or change Tavily API key"
              onClick={() => setTavilyDialogOpen(true)}
            >
              <KeyRound className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--chat-canvas)]">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--chat-border)] bg-[var(--chat-canvas)]/90 px-2 backdrop-blur-md md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-[#5c5748] hover:bg-black/[0.06]"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </Button>
          <span className="min-w-0 truncate text-[15px] font-semibold text-[#2d2a20]">
            {conversations.find((c) => c.id === activeConversationId)?.title ??
              "Miii"}
          </span>
        </header>

        {modelsError ? (
          <p className="shrink-0 border-b border-amber-200/90 bg-amber-50/95 px-4 py-2 text-center text-[12px] text-amber-950/90">
            {modelsError}
          </p>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-4 sm:px-6 sm:pt-8 [-webkit-overflow-scrolling:touch]",
            COMPOSER_GAP,
          )}
        >
          <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-7">
            {!hydrated ? (
              <p className="select-none py-20 text-center text-[15px] text-[#8a8475]">
                Loading…
              </p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-[min(12vh,5rem)] text-center">
                <p className="max-w-md text-[22px] font-medium leading-snug tracking-tight text-[#2d2a20] sm:text-[26px]">
                  How can I help you today?
                </p>
                <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[#8a8475]">
                  Type a message below. Use{" "}
                  <kbd className="rounded-md border border-[var(--chat-border)] bg-[var(--chat-composer)] px-1.5 py-0.5 font-mono text-[12px] text-[#5c5748]">
                    /
                  </kbd>{" "}
                  for commands like tools and web search.
                </p>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex flex-col items-end gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a8475]">
                      You
                    </span>
                    <div className="max-w-[min(100%,32rem)] rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-composer)] px-4 py-3 text-[15px] leading-relaxed text-[#2d2a20] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                      <MarkdownContent className="text-[#2d2a20]">
                        {m.content}
                      </MarkdownContent>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8475]">
                      Miii
                    </span>
                    <MarkdownContent className="text-[15px] leading-[1.65] text-[#3d3929]">
                      {m.content}
                    </MarkdownContent>
                  </div>
                ),
              )
            )}
            {hydrated &&
            sending &&
            messages[messages.length - 1]?.role === "user" ? (
              <div className="flex items-center gap-2.5 text-[13px] text-[#8a8475]">
                <Loader2Icon className="size-4 animate-spin" />
                <span className="font-medium">Thinking…</span>
              </div>
            ) : null}
            <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
          </div>
        </div>
      </div>

      <AddSkillDialog
        open={skillDialogOpen}
        onOpenChange={setSkillDialogOpen}
      />
      <DeleteSkillDialog
        open={deleteSkillDialogOpen}
        onOpenChange={setDeleteSkillDialogOpen}
      />
      <TavilyKeyDialog
        open={tavilyDialogOpen}
        onOpenChange={(open) => {
          setTavilyDialogOpen(open);
          if (!open) setTavilyErrorHint(null);
        }}
        initialKey={tavilyApiKey}
        serverHint={tavilyErrorHint}
        onSave={(k) => {
          setTavilyApiKey(k);
          setWebSearch(true);
          setTavilyErrorHint(null);
        }}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 pt-2 md:px-6 md:pl-[260px]">
        <div
          ref={composerRef}
          className="pointer-events-auto flex w-full max-w-[44rem] items-end gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-composer)] p-2 pl-3 shadow-[0_8px_32px_rgba(45,42,32,0.08)] sm:gap-3 sm:p-2.5 sm:pl-4"
          style={{
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="relative flex min-w-0 flex-1 flex-col">
            {slashMenuActive ? (
              <div
                className="absolute bottom-full left-0 right-0 z-40 mb-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--chat-border)] bg-[var(--chat-composer)] py-1 shadow-lg"
                role="listbox"
                aria-label="Commands"
                onMouseDown={(e) => e.preventDefault()}
              >
                {slashFiltered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[#8a8475]">
                    No matching commands
                  </p>
                ) : (
                  slashFiltered.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={i === slashHighlight}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                        i === slashHighlight
                          ? "bg-[var(--chat-sidebar-hover)]"
                          : "hover:bg-[#f0efe9]",
                      )}
                      onMouseEnter={() => setSlashHighlight(i)}
                      onClick={() => {
                        if (slashCtx) applySlashItem(item, slashCtx);
                      }}
                    >
                      <span className="font-medium text-[#2d2a20]">
                        {item.label}
                      </span>
                      <span className="text-xs text-[#8a8475]">
                        {item.description}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
            <Textarea
              ref={textareaRef}
              placeholder="How can I help?"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setCursorPos(e.target.selectionStart ?? 0);
              }}
              onSelect={(e) =>
                setCursorPos(e.currentTarget.selectionStart ?? 0)
              }
              onKeyUp={(e) =>
                setCursorPos(e.currentTarget.selectionStart ?? 0)
              }
              rows={2}
              className={cn(
                "field-sizing-content min-h-[48px] max-h-40 w-full min-w-0 resize-none rounded-xl border-0 bg-transparent px-1 py-2.5 text-[15px] leading-snug shadow-none",
                "text-[#2d2a20] caret-[#c45c3e] placeholder:text-[#9a9485]",
                "focus-visible:ring-0 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              disabled={sending}
              onKeyDown={(e) => {
                if (
                  slashMenuActive &&
                  slashFiltered.length > 0 &&
                  (e.key === "ArrowDown" || e.key === "ArrowUp")
                ) {
                  e.preventDefault();
                  if (e.key === "ArrowDown") {
                    setSlashHighlight(
                      (h) => (h + 1) % slashFiltered.length,
                    );
                  } else {
                    setSlashHighlight(
                      (h) =>
                        (h - 1 + slashFiltered.length) % slashFiltered.length,
                    );
                  }
                  return;
                }
                if (
                  slashMenuActive &&
                  slashFiltered.length > 0 &&
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  const pick = slashFiltered[slashHighlight];
                  if (pick && slashCtx) applySlashItem(pick, slashCtx);
                  return;
                }
                if (slashMenuActive && e.key === "Escape") {
                  e.preventDefault();
                  setInput((prev) => {
                    const pos =
                      textareaRef.current?.selectionStart ?? cursorPos;
                    const ctx = getSlashLineContext(prev, pos);
                    if (!ctx) return prev;
                    return (
                      prev.slice(0, ctx.lineStart) + prev.slice(ctx.lineEnd)
                    );
                  });
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="default"
            className={cn(
              "mb-0.5 size-10 shrink-0 rounded-full bg-[#2d2a20] text-white shadow-sm",
              "hover:bg-[#1a1814]",
              "disabled:bg-[#d4d0c6] disabled:text-[#9a9485] disabled:opacity-100 disabled:shadow-none",
              "[&_svg]:text-white [&_svg]:opacity-100",
            )}
            onClick={() => void send()}
            disabled={sendDisabled}
            aria-label="Send message"
          >
            {sending ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-white" />
            ) : (
              <SendIcon
                className="size-4 shrink-0 text-white"
                strokeWidth={2}
              />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
