import { normalizeImageApiBaseUrl } from "./image-endpoint";
import { isDesktopRuntime } from "./runtime";

export interface ConversationModelConnection {
  baseUrl: string;
  apiKey: string;
}

export async function listConversationModels(
  connection: ConversationModelConnection,
): Promise<string[]> {
  const baseUrl = normalizeImageApiBaseUrl(connection.baseUrl);
  const apiKey = connection.apiKey.trim();
  if (!apiKey) {
    throw new Error("请先填写 API Key。");
  }

  const models = isDesktopRuntime()
    ? await listModelsInDesktop(baseUrl, apiKey)
    : await listModelsInBrowser(baseUrl, apiKey);

  const unique = [...new Set(models.map((model) => model.trim()).filter(Boolean))];
  if (!unique.length) {
    throw new Error("上游未返回可用的模型名称，请继续手动填写。");
  }
  return unique.sort((left, right) => left.localeCompare(right));
}

async function listModelsInBrowser(baseUrl: string, apiKey: string): Promise<string[]> {
  const endpoint = new URL("models", `${baseUrl}/`).toString();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    throw new Error("无法获取模型列表；可能是网络或浏览器跨域限制，请手动填写。");
  }
  if (!response.ok) {
    throw new Error(`获取模型列表失败（HTTP ${response.status}），请手动填写。`);
  }
  return parseModelIds(await response.json());
}

async function listModelsInDesktop(baseUrl: string, apiKey: string): Promise<string[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const response = await invoke<{ models: string[] }>("list_conversation_models", {
      request: { baseUrl, apiKey },
    });
    return response.models;
  } catch (error) {
    const message = typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
    throw new Error(message || "无法从桌面端获取模型列表，请手动填写。");
  }
}

function parseModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("模型列表响应格式不兼容，请手动填写。");
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error("模型列表响应格式不兼容，请手动填写。");
  }
  return data.flatMap((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) return [];
    const id = (item as { id?: unknown }).id;
    return typeof id === "string" ? [id] : [];
  });
}
