import { createConversation } from "./conversations";
import type {
  ConnectionStatus,
  Conversation,
  WorkspaceSnapshot,
} from "../types";
import type { SceneMeldRuntime } from "./runtime";

export function createInitialWorkspace(): WorkspaceSnapshot {
  const conversation = createConversation();
  return { conversations: [conversation], activeId: conversation.id };
}

export function connectionPresentation(
  status: ConnectionStatus,
  runtime: SceneMeldRuntime,
): {
  label: string;
  description: string;
  color?: string;
} {
  const device = runtime === "desktop" ? "桌面端" : "浏览器";
  return {
    incomplete: { label: "未配置", description: "连接信息尚未填写完整。" },
    ready: {
      label: "配置完整",
      description: `${device}将在下一次生成时直接验证目标 API。`,
      color: "cyan",
    },
    requesting: {
      label: "请求中",
      description: `${device}正在直接向目标 API 请求图片。`,
      color: "processing",
    },
    success: { label: "最近成功", description: "最近一次图片生成请求成功。", color: "green" },
    error: { label: "最近失败", description: "最近一次图片生成请求失败。", color: "red" },
  }[status];
}

export function countGenerations(conversation: Conversation): number {
  return conversation.messages.filter((item) => item.type === "assistant").length;
}

export function mimeExtension(mimeType?: string): string {
  return {
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  }[mimeType || ""] ?? "png";
}

export function missingAttachmentMessage(names: string[]): string {
  const label =
    names.length > 2
      ? `${names.slice(0, 2).join("、")}等 ${names.length} 张图片`
      : names.join("、");
  return `参考图${label ? `“${label}”` : ""}的本地文件已不可用，无法复用这次图生图请求。`;
}
