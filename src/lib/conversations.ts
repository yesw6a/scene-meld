import type { ChatMessage, Conversation } from "../types";

export const MAX_CONVERSATION_TITLE_LENGTH = 80;

export function createId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${id}`;
}

export function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId("conversation"),
    title: "新创作",
    titleMode: "auto",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function promptToTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized || "新创作";
}

export function titleForSubmittedPrompt(conversation: Conversation, prompt: string): string {
  return conversation.titleMode === "auto" && conversation.messages.length === 0
    ? promptToTitle(prompt)
    : conversation.title;
}

export function titleForMessages(
  conversation: Pick<Conversation, "title" | "titleMode">,
  messages: ChatMessage[],
): string {
  if (conversation.titleMode === "manual") {
    return conversation.title;
  }

  const firstPrompt = messages.find((message) => message.type === "user")?.prompt;
  return firstPrompt ? promptToTitle(firstPrompt) : "新创作";
}

export function normalizeConversationTitle(title: string): string | null {
  const normalized = title.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, MAX_CONVERSATION_TITLE_LENGTH) : null;
}

export function restoreLegacyConversationTitle(
  title: string,
  firstPrompt?: string,
): string {
  if (!firstPrompt) {
    return title;
  }

  const normalized = promptToTitle(firstPrompt);
  const legacyTitle =
    normalized.length > 18 ? `${normalized.slice(0, 18)}…` : normalized;

  return title === legacyTitle ? normalized : title;
}
