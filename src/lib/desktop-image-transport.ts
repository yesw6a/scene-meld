import type {
  GenerateImageResponse,
  GenerationRequestSettings,
  ImageAttachmentSource,
} from "../types";
import { IMAGE_MODEL } from "../types";
import type { ImageTransport } from "./image-transport";
import { arrayBufferToBase64 } from "./base64";

interface DesktopAttachment {
  name: string;
  mimeType: string;
  base64: string;
}

interface DesktopRequest {
  requestId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
}

interface DesktopCommandError {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

export class DesktopImageTransport implements ImageTransport {
  async generate(
    settings: GenerationRequestSettings,
    prompt: string,
    signal: AbortSignal,
  ): Promise<GenerateImageResponse> {
    return invokeImageCommand("generate_image", createRequest(settings, prompt), signal);
  }

  async edit(
    settings: GenerationRequestSettings,
    prompt: string,
    attachments: ImageAttachmentSource[],
    signal: AbortSignal,
  ): Promise<GenerateImageResponse> {
    const encodedAttachments = await Promise.all(
      attachments.map(async ({ blob, name, mimeType }) => ({
        name,
        mimeType,
        base64: arrayBufferToBase64(await blob.arrayBuffer()),
      })),
    );

    return invokeImageCommand(
      "edit_image",
      { ...createRequest(settings, prompt), attachments: encodedAttachments },
      signal,
    );
  }
}

function createRequest(
  settings: GenerationRequestSettings,
  prompt: string,
): DesktopRequest {
  return {
    requestId: crypto.randomUUID(),
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: IMAGE_MODEL,
    prompt,
    size: settings.size,
    quality: settings.quality,
  };
}

async function invokeImageCommand(
  command: "generate_image" | "edit_image",
  request: DesktopRequest & { attachments?: DesktopAttachment[] },
  signal: AbortSignal,
): Promise<GenerateImageResponse> {
  if (signal.aborted) {
    throw abortError();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  if (signal.aborted) {
    throw abortError();
  }

  let requestStarted = false;
  const cancel = () => {
    if (!requestStarted) {
      return;
    }
    void invoke("cancel_image_request", { requestId: request.requestId }).catch(
      () => undefined,
    );
  };
  signal.addEventListener("abort", cancel, { once: true });

  try {
    if (signal.aborted) {
      throw abortError();
    }
    requestStarted = true;
    return await invoke<GenerateImageResponse>(command, { request });
  } catch (error) {
    if (signal.aborted || isCancellationError(error)) {
      throw abortError();
    }
    throw normalizeDesktopError(error);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

function isCancellationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as DesktopCommandError).code === "REQUEST_CANCELLED"
  );
}

function normalizeDesktopError(error: unknown): Error {
  if (typeof error === "string") {
    return new Error(error);
  }
  if (typeof error === "object" && error !== null) {
    const commandError = error as DesktopCommandError;
    if (typeof commandError.message === "string") {
      const normalized = new Error(commandError.message) as Error & {
        code?: string;
        status?: number;
      };
      if (typeof commandError.code === "string") {
        normalized.code = commandError.code;
      }
      if (typeof commandError.status === "number") {
        normalized.status = commandError.status;
      }
      return normalized;
    }
  }
  return new Error("桌面端无法完成图片请求，请检查连接设置后重试。");
}

function abortError(): Error {
  const error = new Error("The image request was cancelled.");
  error.name = "AbortError";
  return error;
}
