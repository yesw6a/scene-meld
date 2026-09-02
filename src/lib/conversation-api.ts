import type {
  ConversationSettings,
  ImageAttachmentSource,
  PlanningProgressEvent,
  StoryboardPlan,
} from "../types";
import { normalizeImageApiBaseUrl } from "./image-endpoint";
import { requestPlanningContent } from "./planning-stream";

export async function planStoryboard(
  settings: ConversationSettings,
  sourcePrompt: string,
  shotCount: number | "auto",
  attachments: ImageAttachmentSource[],
  signal: AbortSignal,
  onProgress?: (event: PlanningProgressEvent) => void,
): Promise<StoryboardPlan> {
  const requestedCount = shotCount === "auto" ? 6 : shotCount;
  if (!settings.planningScopes.storyboard || !settings.baseUrl || !settings.apiKey) {
    return createFallbackStoryboard(sourcePrompt, requestedCount);
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `将以下故事拆成 ${requestedCount} 个有连续性的分镜。只返回 JSON，不要 Markdown。故事：${sourcePrompt}`,
    },
  ];
  for (const attachment of attachments.slice(0, 4)) {
    const base64 = await blobToDataUrl(attachment.blob);
    content.push({ type: "image_url", image_url: { url: base64 } });
  }

  let text: string;
  try {
    text = "__TAURI_INTERNALS__" in window
      ? await requestStoryboardInDesktop(settings, sourcePrompt, requestedCount, content, signal, onProgress)
      : await requestStoryboardInBrowser(settings, content, signal, onProgress);
  } catch (error) {
    if (!content.some((part) => part.type === "image_url") || !isUnsupportedVisionError(error)) {
      throw error;
    }
    const textOnly = content.filter((part) => part.type !== "image_url");
    try {
      text = "__TAURI_INTERNALS__" in window
        ? await requestStoryboardInDesktop(settings, sourcePrompt, requestedCount, textOnly, signal, onProgress)
        : await requestStoryboardInBrowser(settings, textOnly, signal, onProgress);
    } catch (retryError) {
      const detail = retryError instanceof Error ? retryError.message : "请检查对话模型是否支持文本输入。";
      throw new Error(`上游不支持参考图，已自动改为纯文本重试，但仍然失败：${detail}`);
    }
  }
  onProgress?.({ type: "validating", requestId: "storyboard" });
  const parsed = parseJsonObject(text);
  const plan = normalizeStoryboardPlan(parsed, sourcePrompt, requestedCount);
  onProgress?.({ type: "completed", requestId: "storyboard" });
  return plan;
}

function isUnsupportedVisionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /image|vision|multimodal|content type|视觉|图片|多模态/i.test(message)
    && /unsupported|not support|invalid|未支持|不支持|无效/i.test(message);
}

async function requestStoryboardInBrowser(
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
    operation: "对话 AI 规划",
    body: {
      model: settings.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "你是分镜导演。输出 StoryboardPlan JSON：styleBible、characters、locations、shots。每个 shot 必须包含 id,index,title,description,camera,action,continuityNotes,imagePrompt。imagePrompt 是可直接交给生图模型的完整提示词。",
        },
        { role: "user", content },
      ],
      ...(settings.supportsStructuredOutput
        ? { response_format: { type: "json_object" } }
        : {}),
    },
  });
}

async function requestStoryboardInDesktop(
  settings: ConversationSettings,
  sourcePrompt: string,
  shotCount: number,
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
    const response = await invoke<{ content: string }>("plan_storyboard", {
      onEvent,
      request: {
        requestId,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        reasoningEffort: settings.reasoningEffort,
        sourcePrompt,
        shotCount,
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
    throw error instanceof Error ? error : new Error("桌面端对话 AI 规划失败。 ");
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

function abortError(): Error {
  const error = new Error("The storyboard request was cancelled.");
  error.name = "AbortError";
  return error;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("对话 AI 未返回有效的分镜 JSON。 ");
  }
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("对话 AI 返回的分镜 JSON 无法解析。 ");
  }
}

function normalizeStoryboardPlan(
  value: Record<string, unknown>,
  sourcePrompt: string,
  requestedCount: number,
): StoryboardPlan {
  const rawShots = Array.isArray(value.shots) ? value.shots : [];
  const shots = rawShots.slice(0, requestedCount).map((shot, index) => {
    const item = (shot && typeof shot === "object" ? shot : {}) as Record<string, unknown>;
    const description = stringValue(item.description, `镜头 ${index + 1}`);
    return {
      id: stringValue(item.id, `shot-${index + 1}`),
      index,
      title: stringValue(item.title, `镜头 ${index + 1}`),
      description,
      camera: stringValue(item.camera, "中景，电影感构图"),
      action: stringValue(item.action, description),
      continuityNotes: stringValue(item.continuityNotes, "保持人物和场景连续"),
      imagePrompt: stringValue(item.imagePrompt, `${sourcePrompt}。${description}`),
    };
  });
  const fallback = createFallbackStoryboard(sourcePrompt, requestedCount);
  return {
    id: `storyboard-${Date.now()}`,
    sourcePrompt,
    styleBible: stringValue(value.styleBible, fallback.styleBible),
    characters: Array.isArray(value.characters) ? (value.characters as StoryboardPlan["characters"]) : [],
    locations: Array.isArray(value.locations) ? (value.locations as StoryboardPlan["locations"]) : [],
    shots: shots.length ? shots : fallback.shots,
  };
}

function createFallbackStoryboard(sourcePrompt: string, count: number): StoryboardPlan {
  return {
    id: `storyboard-${Date.now()}`,
    sourcePrompt,
    styleBible: "电影感叙事，统一人物外观、服装、光线与色彩，画面细节清晰。",
    characters: [],
    locations: [],
    shots: Array.from({ length: count }, (_, index) => ({
      id: `shot-${index + 1}`,
      index,
      title: `镜头 ${index + 1}`,
      description: index === 0 ? "建立场景与人物关系" : "推进故事并保持前后镜头连续",
      camera: index === 0 ? "广角建立镜头" : "中景或近景",
      action: index === 0 ? sourcePrompt : `围绕“${sourcePrompt}”推进第 ${index + 1} 个镜头`,
      continuityNotes: "保持角色外观、服装、道具和时间连续",
      imagePrompt: `${sourcePrompt}。第 ${index + 1} 个分镜，电影感叙事，保持角色与场景连续。`,
    })),
  };
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}
