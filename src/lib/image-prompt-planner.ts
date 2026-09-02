import type {
  ConversationSettings,
  ImageAttachmentSource,
  ImagePromptPlan,
  PlanningProgressEvent,
} from "../types";
import { normalizeImageApiBaseUrl } from "./image-endpoint";
import { requestPlanningContent } from "./planning-stream";

const PLANNER_SYSTEM_PROMPT = `你是图像生成规划器。把用户创作意图整理成可直接交给图像模型的完整提示词，补全主体、环境、构图、镜头、光线、材质与风格，但不得改变核心主题。
当请求多条提示词时，在保持主题一致的前提下规划明确且有价值的构图、镜头或氛围差异；不要把它们写成前后连续的分镜。
只返回 JSON：{"prompts":["..."]}。prompts 数量必须与用户要求完全一致，不要返回 Markdown 或其他字段。`;

export async function planImagePrompts(
  settings: ConversationSettings,
  sourcePrompt: string,
  promptCount: number,
  attachments: ImageAttachmentSource[],
  signal: AbortSignal,
  onProgress?: (event: PlanningProgressEvent) => void,
): Promise<ImagePromptPlan> {
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("AI 规划连接尚未配置完整。");
  }
  if (!sourcePrompt.trim() || sourcePrompt.length > 20_000) {
    throw new Error("待规划的提示词为空或超过 20,000 个字符。");
  }
  if (!Number.isInteger(promptCount) || promptCount < 1 || promptCount > 9) {
    throw new Error("AI 规划数量必须为 1 到 9。");
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `请规划 ${promptCount} 条图像生成提示词。创作需求：${sourcePrompt}`,
    },
  ];
  for (const attachment of attachments.slice(0, 4)) {
    content.push({
      type: "image_url",
      image_url: { url: await blobToDataUrl(attachment.blob) },
    });
  }

  let text: string;
  try {
    text = "__TAURI_INTERNALS__" in window
      ? await requestPlanInDesktop(settings, sourcePrompt, promptCount, content, signal, onProgress)
      : await requestPlanInBrowser(settings, content, signal, onProgress);
  } catch (error) {
    if (!content.some((part) => part.type === "image_url") || !isUnsupportedVisionError(error)) {
      throw error;
    }
    const textOnly = content.filter((part) => part.type !== "image_url");
    text = "__TAURI_INTERNALS__" in window
      ? await requestPlanInDesktop(settings, sourcePrompt, promptCount, textOnly, signal, onProgress)
      : await requestPlanInBrowser(settings, textOnly, signal, onProgress);
  }

  onProgress?.({ type: "validating", requestId: "image-prompts" });
  const plan = normalizeImagePromptPlan(text, promptCount);
  onProgress?.({ type: "completed", requestId: "image-prompts" });
  return plan;
}

async function requestPlanInBrowser(
  settings: ConversationSettings,
  content: Array<Record<string, unknown>>,
  signal: AbortSignal,
  onProgress?: (event: PlanningProgressEvent) => void,
): Promise<string> {
  const baseUrl = normalizeImageApiBaseUrl(settings.baseUrl);
  const endpoint = new URL("chat/completions", `${baseUrl}/`).toString();
  const requestId = crypto.randomUUID();
  return requestPlanningContent({
    endpoint,
    apiKey: settings.apiKey,
    model: settings.model,
    reasoningEffort: settings.reasoningEffort,
    requestId,
    signal,
    onProgress,
    operation: "AI 提示词规划",
    body: {
      model: settings.model,
      temperature: 0.5,
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      ...(settings.supportsStructuredOutput
        ? { response_format: { type: "json_object" } }
        : {}),
    },
  });
}

async function requestPlanInDesktop(
  settings: ConversationSettings,
  sourcePrompt: string,
  promptCount: number,
  content: Array<Record<string, unknown>>,
  signal: AbortSignal,
  onProgress?: (event: PlanningProgressEvent) => void,
): Promise<string> {
  const requestId = crypto.randomUUID();
  const { Channel, invoke } = await import("@tauri-apps/api/core");
  const onEvent = new Channel<PlanningProgressEvent>((event) => onProgress?.(event));
  const cancel = () => {
    void invoke("cancel_image_request", { requestId }).catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw abortError();
    const response = await invoke<{ content: string }>("plan_image_prompts", {
      onEvent,
      request: {
        requestId,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        reasoningEffort: settings.reasoningEffort,
        sourcePrompt,
        promptCount,
        supportsStructuredOutput: settings.supportsStructuredOutput,
        visionImages: content.flatMap((part) => {
          if (part.type !== "image_url" || !part.image_url || typeof part.image_url !== "object") return [];
          const url = (part.image_url as { url?: unknown }).url;
          return typeof url === "string" ? [url] : [];
        }),
      },
    });
    if (signal.aborted) throw abortError();
    return response.content;
  } catch (error) {
    if (signal.aborted) throw abortError();
    throw normalizeDesktopError(error, "桌面端 AI 提示词规划失败。");
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

function normalizeDesktopError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error);
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error(fallback);
}

function normalizeImagePromptPlan(value: string, expectedCount: number): ImagePromptPlan {
  const item = parseJsonObject(value);
  const prompts = Array.isArray(item.prompts)
    ? item.prompts
        .filter((prompt): prompt is string => typeof prompt === "string" && Boolean(prompt.trim()))
        .map((prompt) => prompt.trim().slice(0, 20_000))
    : [];
  if (prompts.length !== expectedCount) {
    throw new Error(`AI 规划返回了 ${prompts.length} 条提示词，预期为 ${expectedCount} 条。`);
  }
  return { prompts };
}

function parseJsonObject(value: string): Record<string, unknown> {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI 规划未返回有效的 JSON。");
  }
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("AI 规划结果无法解析。");
  }
}

function isUnsupportedVisionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /image|vision|multimodal|content type|视觉|图片|多模态/i.test(message)
    && /unsupported|not support|invalid|未支持|不支持|无效/i.test(message);
}

function abortError(): Error {
  const error = new Error("The image prompt planning request was cancelled.");
  error.name = "AbortError";
  return error;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}
