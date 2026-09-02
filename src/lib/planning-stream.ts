import type { PlanningProgressEvent, ReasoningEffort } from "../types";
import {
  classifyUnsupportedReasoning,
  prepareReasoningRequest,
  readUpstreamHttpError,
  reasoningFallbackNotice,
  rememberUnsupportedReasoning,
} from "./reasoning-effort";

const MAX_PLANNING_RESPONSE_BYTES = 2 * 1024 * 1024;

interface PlanningRequestOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  body: Record<string, unknown>;
  requestId: string;
  signal: AbortSignal;
  onProgress?: (event: PlanningProgressEvent) => void;
  operation: string;
}

/**
 * 规划请求使用普通 JSON 响应。规划结果需要完整读取后再校验，避免把半截 JSON
 * 或服务商推理字段误展示为用户可见内容。
 */
export async function requestPlanningContent(
  options: PlanningRequestOptions,
): Promise<string> {
  emit(options, { type: "request-started", requestId: options.requestId });
  const attempt = prepareReasoningRequest(
    options.body,
    options.endpoint,
    options.model,
    options.reasoningEffort,
  );
  if (attempt.fallbackNotice) {
    emit(options, {
      type: "fallback-reasoning-auto",
      requestId: options.requestId,
      detail: attempt.fallbackNotice,
    });
  }

  try {
    return await requestPlanningAttempt({ ...options, body: attempt.body });
  } catch (error) {
    if (!attempt.appliedEffort) throw error;
    const scope = classifyUnsupportedReasoning(error, attempt.appliedEffort);
    if (!scope) throw error;
    rememberUnsupportedReasoning(
      options.endpoint,
      options.model,
      attempt.appliedEffort,
      scope,
    );
    emit(options, {
      type: "fallback-reasoning-auto",
      requestId: options.requestId,
      detail: reasoningFallbackNotice(attempt.appliedEffort),
    });
    return requestPlanningAttempt(options);
  }
}

async function requestPlanningAttempt(
  options: PlanningRequestOptions,
): Promise<string> {
  const response = await fetch(options.endpoint, {
    method: "POST",
    headers: requestHeaders(options.apiKey),
    body: JSON.stringify(options.body),
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readUpstreamHttpError(response, options.operation, options.apiKey);
  }
  emit(options, { type: "response-started", requestId: options.requestId });
  return readJsonPlanningResponse(response, options);
}

async function readJsonPlanningResponse(
  response: Response,
  options: PlanningRequestOptions,
): Promise<string> {
  const text = await readPlanningResponseText(response);
  try {
    const payload = JSON.parse(text) as {
      choices?: Array<{ message?: unknown }>;
    };
    const message = asRecord(payload.choices?.[0]?.message);
    const content = readMessageContent(message?.content);
    if (!content.trim()) {
      throw new Error(`${options.operation}未返回规划内容。`);
    }
    emit(options, {
      type: "content-delta",
      requestId: options.requestId,
      receivedChars: Array.from(content).length,
    });
    return content;
  } catch (error) {
    if (error instanceof Error && error.message.includes("未返回规划内容")) {
      throw error;
    }
    throw new Error(`${options.operation}返回的 JSON 无法解析。`);
  }
}

async function readPlanningResponseText(response: Response): Promise<string> {
  const advertisedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_PLANNING_RESPONSE_BYTES) {
    throw new Error("AI 规划返回的数据过大，已停止读取。");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    receivedBytes += chunk.value?.byteLength ?? 0;
    if (receivedBytes > MAX_PLANNING_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("AI 规划返回的数据过大，已停止读取。");
    }
    text += decoder.decode(chunk.value, { stream: !chunk.done });
    if (chunk.done) return text;
  }
}

function readMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => part && typeof part === "object" && "text" in part
        ? String((part as { text?: unknown }).text ?? "")
        : "")
      .join("\n");
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;
}

function requestHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function emit(
  options: PlanningRequestOptions,
  event: PlanningProgressEvent,
): void {
  options.onProgress?.(event);
}
