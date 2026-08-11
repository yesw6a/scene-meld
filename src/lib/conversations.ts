import type { Conversation } from "../types";

export function createId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${id}`;
}

export function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId("conversation"),
    title: "新创作",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function promptToTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized || "新创作";
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
