import type { ReasoningEffort } from "../types";

const unsupportedReasoningParameters = new Set<string>();
const unsupportedReasoningEfforts = new Set<string>();

export type UnsupportedReasoningScope = "parameter" | "effort";

export interface ReasoningRequestAttempt {
  body: Record<string, unknown>;
  appliedEffort?: Exclude<ReasoningEffort, "auto">;
  fallbackNotice?: string;
}

export class UpstreamHttpError extends Error {
  readonly status: number;
  readonly param?: string;
  readonly upstreamCode?: string;

  constructor(status: number, message: string, param?: string, upstreamCode?: string) {
    super(message);
    this.name = "UpstreamHttpError";
    this.status = status;
    this.param = param;
    this.upstreamCode = upstreamCode;
  }
}

export function prepareReasoningRequest(
  body: Record<string, unknown>,
  endpoint: string,
  model: string,
  effort: ReasoningEffort,
): ReasoningRequestAttempt {
  if (effort === "auto") {
    return { body };
  }

  const connectionKey = reasoningConnectionKey(endpoint, model);
  const effortKey = reasoningEffortKey(connectionKey, effort);
  if (
    unsupportedReasoningParameters.has(connectionKey) ||
    unsupportedReasoningEfforts.has(effortKey)
  ) {
    return { body, fallbackNotice: reasoningFallbackNotice(effort) };
  }

  const reasoningBody: Record<string, unknown> = { ...body, reasoning_effort: effort };
  return { body: reasoningBody, appliedEffort: effort };
}

export function classifyUnsupportedReasoning(
  error: unknown,
  effort: Exclude<ReasoningEffort, "auto">,
): UnsupportedReasoningScope | null {
  if (!(error instanceof UpstreamHttpError) || ![400, 422].includes(error.status)) {
    return null;
  }

  const detail = [error.message, error.param, error.upstreamCode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/reasoning[_ -]?effort/.test(detail)) {
    return null;
  }
  if (!/(unsupported|not support|unknown|unrecognized|invalid|not allowed|not permitted|不支持|未知|无法识别|无效|不允许)/i.test(detail)) {
    return null;
  }

  const valueSpecific = new RegExp(
    `unsupported[_ -]?value|invalid[_ -]?value|allowed values?|supported values?|one of|enum|value.{0,40}${effort}|${effort}.{0,40}value`,
    "i",
  ).test(detail);
  return valueSpecific ? "effort" : "parameter";
}

export function rememberUnsupportedReasoning(
  endpoint: string,
  model: string,
  effort: Exclude<ReasoningEffort, "auto">,
  scope: UnsupportedReasoningScope,
): void {
  const connectionKey = reasoningConnectionKey(endpoint, model);
  if (scope === "parameter") {
    unsupportedReasoningParameters.add(connectionKey);
    return;
  }
  unsupportedReasoningEfforts.add(reasoningEffortKey(connectionKey, effort));
}

export function reasoningFallbackNotice(
  effort: Exclude<ReasoningEffort, "auto">,
): string {
  return `当前模型不支持“${reasoningEffortLabel(effort)}”推理程度，已改用模型默认设置，本次任务将继续执行。`;
}

export async function readUpstreamHttpError(
  response: Response,
  operation: string,
  apiKey?: string,
): Promise<UpstreamHttpError> {
  let message = "";
  let param: string | undefined;
  let upstreamCode: string | undefined;
  try {
    const payload = JSON.parse(await response.text()) as {
      error?: { message?: unknown; param?: unknown; code?: unknown };
    };
    message = typeof payload.error?.message === "string" ? payload.error.message : "";
    param = typeof payload.error?.param === "string" ? payload.error.param : undefined;
    upstreamCode = typeof payload.error?.code === "string" ? payload.error.code : undefined;
  } catch {
    // Keep the status-only error when the upstream does not return JSON.
  }
  if (apiKey && message.includes(apiKey)) {
    message = message.replaceAll(apiKey, "[REDACTED]");
  }
  return new UpstreamHttpError(
    response.status,
    message || `${operation}失败（HTTP ${response.status}）。`,
    param,
    upstreamCode,
  );
}

export function mergeNotices(...notices: Array<string | undefined>): string | undefined {
  const values = [...new Set(notices.map((notice) => notice?.trim()).filter(Boolean))] as string[];
  return values.length ? values.join(" ").slice(0, 1_000) : undefined;
}

function reasoningConnectionKey(endpoint: string, model: string): string {
  return `${endpoint.trim()}\n${model.trim()}`;
}

function reasoningEffortKey(
  connectionKey: string,
  effort: Exclude<ReasoningEffort, "auto">,
): string {
  return `${connectionKey}\n${effort}`;
}

function reasoningEffortLabel(effort: Exclude<ReasoningEffort, "auto">): string {
  if (effort === "low") return "低";
  if (effort === "medium") return "中";
  return "高";
}
