import type {
  GenerateImageResponse,
  GenerationRequestSettings,
  ImageAttachmentSource,
} from "../types";
import type { ImageTransport } from "./image-transport";
import {
  buildImageApiEndpoint,
  endpointHostLabel,
  isAllowedRemoteImageUrl,
} from "./image-endpoint";
import {
  detectImageMimeType,
  IMAGE_MIME_TYPES,
  type ImageMimeType,
} from "./image-mime";

const MAX_IMAGE_RESPONSE_BYTES = 25 * 1024 * 1024;
const MAX_JSON_RESPONSE_BYTES = Math.ceil((MAX_IMAGE_RESPONSE_BYTES * 4) / 3) + 1024 * 1024;
const SAFE_IMAGE_TYPES = new Set<string>(IMAGE_MIME_TYPES);

interface UpstreamImage {
  b64_json?: unknown;
  url?: unknown;
  revised_prompt?: unknown;
  mime_type?: unknown;
}

interface UpstreamPayload {
  data?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

export class StudioApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "StudioApiError";
  }
}

export class BrowserImageTransport implements ImageTransport {
  generate(
    settings: GenerationRequestSettings,
    prompt: string,
    signal: AbortSignal,
  ): Promise<GenerateImageResponse> {
    return requestGeneratedImageInBrowser(settings, prompt, signal);
  }

  edit(
    settings: GenerationRequestSettings,
    prompt: string,
    attachments: ImageAttachmentSource[],
    signal: AbortSignal,
  ): Promise<GenerateImageResponse> {
    return requestEditedImageInBrowser(settings, prompt, attachments, signal);
  }
}

let transportPromise: Promise<ImageTransport> | null = null;

export async function requestGeneratedImage(
  settings: GenerationRequestSettings,
  prompt: string,
  signal: AbortSignal,
): Promise<GenerateImageResponse> {
  return (await getImageTransport()).generate(settings, prompt, signal);
}

export async function requestEditedImage(
  settings: GenerationRequestSettings,
  prompt: string,
  attachments: ImageAttachmentSource[],
  signal: AbortSignal,
): Promise<GenerateImageResponse> {
  return (await getImageTransport()).edit(settings, prompt, attachments, signal);
}

async function requestGeneratedImageInBrowser(
  settings: GenerationRequestSettings,
  prompt: string,
  signal: AbortSignal,
): Promise<GenerateImageResponse> {
  const endpoint = buildImageApiEndpoint(settings.baseUrl, "images/generations");
  const response = await fetchDirectImageApi(
    endpoint,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        prompt,
        size: settings.size,
        quality: settings.quality,
        output_format: "png",
      }),
    },
    signal,
  );

  return parseImageResponse(response, endpoint, settings.apiKey, signal, "图片生成");
}

async function requestEditedImageInBrowser(
  settings: GenerationRequestSettings,
  prompt: string,
  attachments: ImageAttachmentSource[],
  signal: AbortSignal,
): Promise<GenerateImageResponse> {
  const endpoint = buildImageApiEndpoint(settings.baseUrl, "images/edits");
  const formData = new FormData();
  formData.append("model", settings.model);
  formData.append("prompt", prompt);
  formData.append("size", settings.size);
  formData.append("quality", settings.quality);
  formData.append("output_format", "png");

  for (const attachment of attachments) {
    formData.append("image[]", attachment.blob, attachment.name);
  }

  const response = await fetchDirectImageApi(
    endpoint,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      body: formData,
    },
    signal,
  );

  return parseImageResponse(response, endpoint, settings.apiKey, signal, "图生图请求");
}

async function fetchDirectImageApi(
  endpoint: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(endpoint, {
      ...init,
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new StudioApiError(
      `浏览器无法连接 ${endpointHostLabel(endpoint, "目标 API")}。请检查网络、HTTPS、CORS 预检和重定向设置；本项目不提供图片请求中转服务，未开放浏览器 CORS 的端点可改用 SceneMeld Desktop。`,
      undefined,
      "NETWORK_OR_CORS_ERROR",
    );
  }
}

async function getImageTransport(): Promise<ImageTransport> {
  if (!transportPromise) {
    transportPromise = "__TAURI_INTERNALS__" in window
      ? import("./desktop-image-transport").then(
          ({ DesktopImageTransport }) => new DesktopImageTransport(),
        )
      : Promise.resolve(new BrowserImageTransport());
  }
  return transportPromise;
}

async function parseImageResponse(
  response: Response,
  endpoint: string,
  apiKey: string,
  signal: AbortSignal,
  operation: string,
): Promise<GenerateImageResponse> {
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    const upstreamMessage =
      payload?.error && typeof payload.error.message === "string"
        ? redactSecret(payload.error.message, apiKey)
        : null;
    const upstreamCode =
      payload?.error && typeof payload.error.code === "string"
        ? payload.error.code
        : undefined;

    throw new StudioApiError(
      upstreamMessage || `${operation}失败（HTTP ${response.status}）。`,
      response.status,
      upstreamCode,
    );
  }

  const image = firstImage(payload);
  const revisedPrompt =
    typeof image.revised_prompt === "string" ? image.revised_prompt : null;

  if (typeof image.b64_json === "string" && image.b64_json) {
    assertBase64Size(image.b64_json);
    const detectedMimeType = detectBase64MimeType(image.b64_json);
    return {
      image: image.b64_json,
      mimeType: resolveImageMimeType(
        typeof image.mime_type === "string" && image.mime_type.startsWith("image/")
          ? image.mime_type
          : "",
        detectedMimeType,
      ),
      revisedPrompt,
      source: "b64_json",
    };
  }

  if (typeof image.url === "string" && image.url) {
    const remoteImage = await downloadRemoteImage(image.url, endpoint, signal);
    return {
      image: remoteImage.base64,
      mimeType: remoteImage.mimeType,
      revisedPrompt,
      source: "url",
    };
  }

  throw new StudioApiError(
    "目标 API 返回了无法识别的图片数据，需要 data[0].b64_json 或 data[0].url。",
    response.status,
    "UNSUPPORTED_RESPONSE",
  );
}

async function readJsonPayload(response: Response): Promise<UpstreamPayload | null> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_JSON_RESPONSE_BYTES) {
    throw new StudioApiError(
      "目标 API 返回的数据过大，浏览器已停止处理。",
      response.status,
      "RESPONSE_TOO_LARGE",
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_JSON_RESPONSE_BYTES) {
    throw new StudioApiError(
      "目标 API 返回的数据过大，浏览器已停止处理。",
      response.status,
      "RESPONSE_TOO_LARGE",
    );
  }

  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as UpstreamPayload;
  } catch {
    if (!response.ok) {
      return null;
    }

    throw new StudioApiError(
      "目标 API 没有返回有效的 JSON 数据。",
      response.status,
      "INVALID_JSON_RESPONSE",
    );
  }
}

function firstImage(payload: UpstreamPayload | null): UpstreamImage {
  if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new StudioApiError(
      "目标 API 返回的数据中没有图片结果。",
      undefined,
      "MISSING_IMAGE_RESULT",
    );
  }

  const image = payload.data[0];
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    throw new StudioApiError(
      "目标 API 返回了无法识别的图片结果。",
      undefined,
      "INVALID_IMAGE_RESULT",
    );
  }

  return image as UpstreamImage;
}

async function downloadRemoteImage(
  value: string,
  endpoint: string,
  signal: AbortSignal,
): Promise<{ base64: string; mimeType: string }> {
  const imageUrl = isAllowedRemoteImageUrl(value, endpoint);
  let response: Response;

  try {
    response = await fetch(imageUrl, {
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new StudioApiError(
      "上游返回了图片 URL，但图片服务器未允许浏览器跨域读取，无法保存到本地或继续编辑。请让上游返回 Base64，或为图片地址启用 CORS。",
      undefined,
      "REMOTE_IMAGE_CORS_ERROR",
    );
  }

  if (!response.ok) {
    throw new StudioApiError(
      `下载上游图片失败（HTTP ${response.status}）。`,
      response.status,
      "REMOTE_IMAGE_DOWNLOAD_ERROR",
    );
  }

  isAllowedRemoteImageUrl(response.url || imageUrl.toString(), imageUrl.toString());

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_IMAGE_RESPONSE_BYTES) {
    throw new StudioApiError(
      "上游图片超过 25 MB，浏览器已停止下载。",
      response.status,
      "REMOTE_IMAGE_TOO_LARGE",
    );
  }

  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_RESPONSE_BYTES) {
    throw new StudioApiError(
      "上游图片超过 25 MB，浏览器已停止处理。",
      response.status,
      "REMOTE_IMAGE_TOO_LARGE",
    );
  }

  const advertisedMimeType = (response.headers.get("content-type") || blob.type)
    .split(";", 1)[0]
    .toLowerCase();
  if (advertisedMimeType && !SAFE_IMAGE_TYPES.has(advertisedMimeType)) {
    throw new StudioApiError(
      "上游图片 URL 没有返回受支持的 PNG、JPEG、WebP 或 GIF 图片。",
      response.status,
      "INVALID_REMOTE_IMAGE",
    );
  }

  const base64 = await blobToBase64(blob, signal);
  const detectedMimeType = detectBase64MimeType(base64);
  return {
    base64,
    mimeType: resolveImageMimeType(advertisedMimeType, detectedMimeType),
  };
}

function blobToBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abortReader = () => reader.abort();
    const cleanup = () => signal.removeEventListener("abort", abortReader);

    reader.addEventListener("load", () => {
      cleanup();
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new StudioApiError("无法读取上游图片。", undefined, "IMAGE_READ_ERROR"));
        return;
      }

      resolve(result.slice(result.indexOf(",") + 1));
    });
    reader.addEventListener("error", () => {
      cleanup();
      reject(new StudioApiError("无法读取上游图片。", undefined, "IMAGE_READ_ERROR"));
    });
    reader.addEventListener("abort", () => {
      cleanup();
      const error = new Error("The image request was cancelled.");
      error.name = "AbortError";
      reject(error);
    });

    if (signal.aborted) {
      const error = new Error("The image request was cancelled.");
      error.name = "AbortError";
      reject(error);
      return;
    }

    signal.addEventListener("abort", abortReader, { once: true });
    reader.readAsDataURL(blob);
  });
}

function assertBase64Size(base64: string): void {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new StudioApiError(
      "目标 API 返回了无效的 Base64 图片数据。",
      undefined,
      "INVALID_BASE64_IMAGE",
    );
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const estimatedBytes = Math.floor((base64.length * 3) / 4) - padding;
  if (estimatedBytes > MAX_IMAGE_RESPONSE_BYTES) {
    throw new StudioApiError(
      "目标 API 返回的图片超过 25 MB，浏览器已停止处理。",
      undefined,
      "IMAGE_TOO_LARGE",
    );
  }
}

function detectBase64MimeType(base64: string): ImageMimeType {
  try {
    const sample = window.atob(base64.slice(0, 64));
    const detected = detectImageMimeType(
      Uint8Array.from(sample, (character) => character.charCodeAt(0)),
    );
    if (detected) {
      return detected;
    }
  } catch {
    // Fall through to the unsupported-image error below.
  }

  throw new StudioApiError(
    "目标 API 返回的数据不是受支持的 PNG、JPEG、WebP 或 GIF 图片。",
    undefined,
    "UNSUPPORTED_IMAGE_TYPE",
  );
}

function resolveImageMimeType(advertised: string, detected: ImageMimeType): ImageMimeType {
  const normalizedAdvertised = advertised.toLowerCase();
  if (normalizedAdvertised && normalizedAdvertised !== detected) {
    throw new StudioApiError(
      "目标 API 声明的图片格式与实际图片内容不一致。",
      undefined,
      "IMAGE_TYPE_MISMATCH",
    );
  }

  return detected;
}

function redactSecret(message: string, secret: string): string {
  return (secret ? message.replaceAll(secret, "[redacted]") : message).slice(0, 500);
}
