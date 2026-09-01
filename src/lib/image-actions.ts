import { saveImageBlob, type ImageSaveResult } from "./image-save";
import { isDesktopRuntime } from "./runtime";
import { mimeExtension } from "./studio-presenters";

export interface ImageActionSource {
  url: string;
  fileName: string;
  mimeType?: string;
}

export type ImageCopyErrorCode =
  | "permission-denied"
  | "clipboard-busy"
  | "unsupported"
  | "source-unavailable"
  | "unknown";

export class ImageCopyError extends Error {
  constructor(
    public readonly code: ImageCopyErrorCode,
    message: string,
    public readonly technicalDetails?: string,
  ) {
    super(message);
    this.name = "ImageCopyError";
  }
}

export function generatedImageFileName(createdAt: number, mimeType?: string): string {
  const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, "-");
  return `scenemeld-${timestamp}.${mimeExtension(mimeType)}`;
}

export async function copyImageFromUrl(source: ImageActionSource): Promise<void> {
  const { blob, mimeType } = await loadImageBlob(source);
  let nativeError: unknown;

  if (isDesktopRuntime()) {
    try {
      await writeDesktopImage(blob);
      return;
    } catch (error) {
      nativeError = error;
    }
  }

  try {
    await writeWebImage(blob, mimeType);
  } catch (error) {
    throw normalizeCopyError(nativeError ?? error, error);
  }
}

export async function downloadImageFromUrl(source: ImageActionSource): Promise<ImageSaveResult> {
  const { blob, mimeType } = await loadImageBlob(source);
  return saveImageBlob(blob, source.fileName, mimeType);
}

export function downloadImageBlob(
  blob: Blob,
  fileName: string,
  mimeType?: string,
): Promise<ImageSaveResult> {
  return saveImageBlob(blob, fileName, resolveImageMimeType(blob, mimeType));
}

async function loadImageBlob(source: ImageActionSource): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`image source returned HTTP ${response.status}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("image source is empty");
    }

    return { blob, mimeType: resolveImageMimeType(blob, source.mimeType) };
  } catch (error) {
    throw new ImageCopyError(
      "source-unavailable",
      "当前图片文件无法读取，可能已被清理或临时链接已经失效。",
      technicalDetails(error),
    );
  }
}

function resolveImageMimeType(blob: Blob, fallback?: string): string {
  return blob.type || fallback || "image/png";
}

async function writeDesktopImage(blob: Blob): Promise<void> {
  const [{ Image }, { writeImage }] = await Promise.all([
    import("@tauri-apps/api/image"),
    import("@tauri-apps/plugin-clipboard-manager"),
  ]);
  const image = await Image.fromBytes(await blob.arrayBuffer());
  try {
    await writeImage(image);
  } finally {
    await image.close().catch(() => undefined);
  }
}

async function writeWebImage(blob: Blob, mimeType: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new ImageCopyError(
      "unsupported",
      "当前浏览器或页面环境不支持直接复制图片。",
    );
  }
  const clipboardBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  await navigator.clipboard.write([new ClipboardItem({ [mimeType]: clipboardBlob })]);
}

function normalizeCopyError(primary: unknown, fallback: unknown): ImageCopyError {
  if (primary instanceof ImageCopyError) return primary;
  if (fallback instanceof ImageCopyError && errorCode(primary) === "unknown") return fallback;

  const code = errorCode(primary);
  return new ImageCopyError(code, copyErrorMessage(code), technicalDetails(primary));
}

function errorCode(error: unknown): ImageCopyErrorCode {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message = technicalDetails(error).toLowerCase();
  if (
    name === "notallowederror" ||
    message.includes("permission") ||
    message.includes("denied") ||
    message.includes("not allowed")
  ) {
    return "permission-denied";
  }
  if (
    message.includes("busy") ||
    message.includes("locked") ||
    message.includes("open clipboard") ||
    message.includes("clipboard is unavailable")
  ) {
    return "clipboard-busy";
  }
  if (
    name === "notsupportederror" ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("not available")
  ) {
    return "unsupported";
  }
  return "unknown";
}

function copyErrorMessage(code: ImageCopyErrorCode): string {
  return {
    "permission-denied": "当前页面没有获得写入剪贴板的权限。",
    "clipboard-busy": "系统剪贴板暂时被其他程序占用。",
    unsupported: "当前环境不支持直接复制图片。",
    "source-unavailable": "当前图片文件无法读取。",
    unknown: "系统没有完成图片复制。",
  }[code];
}

function technicalDetails(error: unknown): string {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return detail.slice(0, 500);
}
