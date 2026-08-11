import { createId } from "./conversations";
import {
  dataUrlToBlob,
  loadGeneratedImage,
  saveGeneratedImage,
} from "./studio-db";
import type {
  AssistantMessage,
  DraftImageAttachment,
  ImageAttachmentSource,
  MessageImageAttachment,
} from "../types";

export const IMAGE_ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp";
export const MAX_IMAGE_ATTACHMENT_COUNT = 16;
export const MAX_IMAGE_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_ATTACHMENTS_TOTAL_BYTES = 50 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface AddImageFilesResult {
  attachments: DraftImageAttachment[];
  errors: string[];
}

export type ResolveImageAttachmentsResult =
  | { ok: true; sources: ImageAttachmentSource[] }
  | { ok: false; missing: string[] };

export interface PreparedImageAttachments {
  messageAttachments: MessageImageAttachment[];
  requestAttachments: ImageAttachmentSource[];
  persistenceFailed: boolean;
}

export function addImageFiles(
  current: DraftImageAttachment[],
  files: File[] | FileList,
): AddImageFilesResult {
  const attachments = [...current];
  const errors = new Set<string>();
  let totalBytes = attachments.reduce((total, item) => total + item.size, 0);

  for (const file of Array.from(files)) {
    if (attachments.length >= MAX_IMAGE_ATTACHMENT_COUNT) {
      errors.add(`最多可添加 ${MAX_IMAGE_ATTACHMENT_COUNT} 张参考图。`);
      break;
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      errors.add(`“${file.name || "未命名图片"}”格式不受支持，请使用 PNG、JPEG 或 WebP。`);
      continue;
    }

    if (file.size > MAX_IMAGE_ATTACHMENT_BYTES) {
      errors.add(`“${file.name}”超过单张 20 MB 的限制。`);
      continue;
    }

    if (totalBytes + file.size > MAX_IMAGE_ATTACHMENTS_TOTAL_BYTES) {
      errors.add("参考图总大小不能超过 50 MB。");
      continue;
    }

    attachments.push({
      uid: createId("draft-image"),
      name: file.name || `reference-${attachments.length + 1}.${mimeExtension(file.type)}`,
      mimeType: file.type,
      size: file.size,
      blob: file,
      persisted: false,
      previewUrl: URL.createObjectURL(file),
    });
    totalBytes += file.size;
  }

  return { attachments, errors: [...errors] };
}

export async function resolveMessageImageAttachments(
  attachments: MessageImageAttachment[] = [],
): Promise<ResolveImageAttachmentsResult> {
  const resolved = await Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.blob) {
        return {
          source: {
            imageId: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            blob: attachment.blob,
            persisted: false,
          } satisfies ImageAttachmentSource,
        };
      }

      const blob = await loadGeneratedImage(attachment.id);
      if (!blob) {
        return { missing: attachment.name };
      }

      return {
        source: {
          imageId: attachment.id,
          name: attachment.name,
          mimeType: attachment.mimeType || blob.type || "image/png",
          size: attachment.size || blob.size,
          blob,
          persisted: true,
        } satisfies ImageAttachmentSource,
      };
    }),
  );
  const missing: string[] = [];
  const sources: ImageAttachmentSource[] = [];

  for (const item of resolved) {
    if ("missing" in item && item.missing) {
      missing.push(item.missing);
    } else if ("source" in item && item.source) {
      sources.push(item.source);
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, sources };
}

export async function resolveAssistantImageAttachment(
  message: AssistantMessage,
): Promise<ResolveImageAttachmentsResult> {
  const fallbackName = `generated-${new Date(message.createdAt)
    .toISOString()
    .replace(/[:.]/g, "-")}.${mimeExtension(message.mimeType)}`;

  if (message.imageDataUrl) {
    const blob = await dataUrlToBlob(message.imageDataUrl);
    return {
      ok: true,
      sources: [
        {
          name: fallbackName,
          mimeType: message.mimeType || blob.type || "image/png",
          size: blob.size,
          blob,
          persisted: false,
        },
      ],
    };
  }

  if (message.imageId) {
    const blob = await loadGeneratedImage(message.imageId);
    if (blob) {
      return {
        ok: true,
        sources: [
          {
            imageId: message.imageId,
            name: fallbackName,
            mimeType: message.mimeType || blob.type || "image/png",
            size: blob.size,
            blob,
            persisted: true,
          },
        ],
      };
    }
  }

  return { ok: false, missing: [fallbackName] };
}

export async function prepareImageAttachments(
  sources: ImageAttachmentSource[],
  persistAssets: boolean,
  createdAt: number,
): Promise<PreparedImageAttachments> {
  const messageAttachments: MessageImageAttachment[] = [];
  const requestAttachments: ImageAttachmentSource[] = [];
  let persistenceFailed = false;
  let canPersist = persistAssets;

  for (const source of sources) {
    const imageId = source.imageId ?? createId("input-image");
    let persisted = source.persisted;

    if (!persisted && canPersist) {
      try {
        await saveGeneratedImage(imageId, source.blob, source.mimeType, createdAt);
        persisted = true;
      } catch {
        persistenceFailed = true;
        canPersist = false;
      }
    }

    requestAttachments.push({ ...source, imageId, persisted });
    messageAttachments.push({
      id: imageId,
      name: source.name,
      mimeType: source.mimeType,
      size: source.size,
      ...(persisted ? {} : { blob: source.blob }),
    });
  }

  return { messageAttachments, requestAttachments, persistenceFailed };
}

export function createDraftAttachments(
  sources: ImageAttachmentSource[],
): DraftImageAttachment[] {
  return sources.map((source) => ({
    ...source,
    uid: createId("draft-image"),
    previewUrl: URL.createObjectURL(source.blob),
  }));
}

export function revokeDraftAttachmentPreviews(attachments: DraftImageAttachment[]): void {
  for (const attachment of attachments) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function formatImageAttachmentBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeExtension(mimeType?: string): string {
  return {
    "image/jpeg": "jpg",
    "image/webp": "webp",
  }[mimeType || ""] ?? "png";
}
