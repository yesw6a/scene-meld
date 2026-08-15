import { saveImageBlob, type ImageSaveResult } from "./image-save";
import { mimeExtension } from "./studio-presenters";

export interface ImageActionSource {
  url: string;
  fileName: string;
  mimeType?: string;
}

export function generatedImageFileName(createdAt: number, mimeType?: string): string {
  const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, "-");
  return `scenemeld-${timestamp}.${mimeExtension(mimeType)}`;
}

export async function copyImageFromUrl(source: ImageActionSource): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("image clipboard is unavailable");
  }

  const { blob, mimeType } = await loadImageBlob(source);
  const clipboardBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  await navigator.clipboard.write([new ClipboardItem({ [mimeType]: clipboardBlob })]);
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
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error("image source could not be read");
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("image source is empty");
  }

  return { blob, mimeType: resolveImageMimeType(blob, source.mimeType) };
}

function resolveImageMimeType(blob: Blob, fallback?: string): string {
  return blob.type || fallback || "image/png";
}
