export const CONVERSATIONS_STORAGE_KEY = "miii.conversations.v1";

export type ChatRole = "user" | "assistant";

export type StoredChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type StoredConversation = {
  id: string;
  title: string;
  messages: StoredChatMessage[];
  updatedAt: number;
};

export type ConversationsState = {
  version: 1;
  conversations: StoredConversation[];
  activeConversationId: string;
};

function newConversation(): StoredConversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

export function createDefaultConversationsState(): ConversationsState {
  const c = newConversation();
  return {
    version: 1,
    conversations: [c],
    activeConversationId: c.id,
  };
}

export function titleFromMessages(messages: StoredChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const line = firstUser.content.trim().split("\n")[0] ?? "";
  if (!line) return "New chat";
  return line.length > 48 ? `${line.slice(0, 45)}…` : line;
}

function isChatMessage(x: unknown): x is StoredChatMessage {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.role === "user" || o.role === "assistant") &&
    typeof o.content === "string"
  );
}

function normalizeConversation(x: unknown): StoredConversation | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const rawMsgs = o.messages;
  if (!Array.isArray(rawMsgs)) return null;
  const messages: StoredChatMessage[] = [];
  for (const m of rawMsgs) {
    if (isChatMessage(m)) messages.push(m);
  }
  const title =
    typeof o.title === "string" && o.title.length > 0 ? o.title : "New chat";
  const updatedAt =
    typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
      ? o.updatedAt
      : Date.now();
  return { id: o.id, title, messages, updatedAt };
}

export function normalizeConversationsState(
  parsed: unknown,
): ConversationsState {
  if (!parsed || typeof parsed !== "object") {
    return createDefaultConversationsState();
  }
  const o = parsed as Record<string, unknown>;
  const rawList = o.conversations;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return createDefaultConversationsState();
  }
  const conversations: StoredConversation[] = [];
  for (const item of rawList) {
    const c = normalizeConversation(item);
    if (c) conversations.push(c);
  }
  if (conversations.length === 0) {
    return createDefaultConversationsState();
  }
  let activeConversationId =
    typeof o.activeConversationId === "string"
      ? o.activeConversationId
      : conversations[0].id;
  if (!conversations.some((c) => c.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }
  return {
    version: 1,
    conversations,
    activeConversationId,
  };
}

export function loadConversationsState(): ConversationsState {
  if (typeof window === "undefined") {
    return createDefaultConversationsState();
  }
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return createDefaultConversationsState();
    const parsed: unknown = JSON.parse(raw);
    return normalizeConversationsState(parsed);
  } catch {
    return createDefaultConversationsState();
  }
}

export function saveConversationsState(state: ConversationsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    /* quota or private mode */
  }
}
