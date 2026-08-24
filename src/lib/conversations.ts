import type { ChatMessage, Conversation } from "../types";
import { parsePromptDirectives } from "./prompt-directives";

export const MAX_CONVERSATION_TITLE_LENGTH = 80;
export const MAX_AUTO_CONVERSATION_TITLE_LENGTH = 24;

const EMPTY_CONVERSATION_TITLE = "新创作";
const DIRECTIVE_ONLY_ERROR = "已识别生成规格，但还缺少具体的画面或故事内容。";
const GENERIC_TITLE_PATTERN = /^(?:(?:第\s*)?(?:镜头|场景|画面|分镜|步骤|部分|章节)\s*[一二三四五六七八九十\d]*|标题|画面描述|内容描述|提示词|正向提示词|描述|要求|需求|主题|主体|风格|构图|光线|色彩|背景|动作|细节|文字|说明)$/i;

export function createId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${id}`;
}

export function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId("conversation"),
    title: EMPTY_CONVERSATION_TITLE,
    titleMode: "auto",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function promptToTitle(prompt: string): string {
  const parsed = parsePromptDirectives(prompt);
  const content = parsed.errors.includes(DIRECTIVE_ONLY_ERROR)
    ? ""
    : parsed.cleanPrompt;
  const lines = content
    .split(/\r?\n/)
    .map(cleanTitleCandidate)
    .filter(Boolean);

  for (const line of lines) {
    const headingMatch = line.match(/^([^:：]{1,16})[:：]\s*(.+)$/);
    const heading = headingMatch ? cleanTitleCandidate(headingMatch[1] ?? "") : "";
    if (heading && !isGenericTitle(heading)) {
      return truncateAutoTitle(heading);
    }
  }

  for (const line of lines) {
    const segments = line.split(/[。！？!?；;，,、:：]/);
    for (const segment of segments) {
      const candidate = cleanTitleCandidate(segment);
      if (candidate && !isGenericTitle(candidate)) {
        return truncateAutoTitle(candidate);
      }
    }
  }

  return EMPTY_CONVERSATION_TITLE;
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
  return firstPrompt ? promptToTitle(firstPrompt) : EMPTY_CONVERSATION_TITLE;
}

export function normalizeConversationTitle(title: string): string | null {
  const normalized = title.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, MAX_CONVERSATION_TITLE_LENGTH) : null;
}

function cleanTitleCandidate(value: string): string {
  let candidate = value
    .replace(/^\s*(?:(?:#{1,6}|>|[-*+])\s*|(?:\d+|[一二三四五六七八九十]+)[.、)]\s*)+/, "")
    .replace(/^[「『“\"']+|[」』”\"']+$/g, "")
    .trim();

  for (let pass = 0; pass < 3; pass += 1) {
    const previous = candidate;
    candidate = candidate
      .replace(/^(?:(?:请|麻烦)(?:你)?(?:帮我|为我|给我)?|帮我|替我|为我|给我|我(?:想要|需要|要))\s*/i, "")
      .replace(/^(?:生成|制作|创建|输出|设计|绘制|画出?|做(?:出|成)?)(?:一张|一个|一幅|一组|一些)?\s*/i, "")
      .trim();
    if (candidate === previous) break;
  }

  return candidate
    .replace(/^[\s:：,，。;；、-]+|[\s:：,，。;；、-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericTitle(value: string): boolean {
  return GENERIC_TITLE_PATTERN.test(value.replace(/\s+/g, ""));
}

function truncateAutoTitle(value: string): string {
  const characters = Array.from(value);
  if (characters.length <= MAX_AUTO_CONVERSATION_TITLE_LENGTH) {
    return value;
  }

  return `${characters.slice(0, MAX_AUTO_CONVERSATION_TITLE_LENGTH - 1).join("")}…`;
}
