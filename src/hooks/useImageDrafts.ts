import { useCallback, useEffect, useRef, useState } from "react";

import {
  addImageFiles,
  createDraftAttachments,
  resolveAssistantImageAttachment,
  resolveMessageImageAttachments,
  revokeDraftAttachmentPreviews,
  type ResolveImageAttachmentsResult,
} from "../lib/image-attachments";
import type {
  AssistantMessage,
  DraftImageAttachment,
  ImageAttachmentSource,
  MessageImageAttachment,
} from "../types";

export interface RestoreImageDraftsResult {
  ok: boolean;
  missing?: string[];
  cancelled?: boolean;
}

export default function useImageDrafts(scopeKey: string | null) {
  const [attachments, setAttachments] = useState<DraftImageAttachment[]>([]);
  const attachmentsRef = useRef<DraftImageAttachment[]>([]);
  const scopeRef = useRef(scopeKey);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);

  const replace = useCallback((next: DraftImageAttachment[]) => {
    revokeDraftAttachmentPreviews(attachmentsRef.current);
    attachmentsRef.current = next;
    setAttachments(next);
  }, []);

  const clear = useCallback(() => {
    operationRef.current += 1;
    replace([]);
  }, [replace]);

  const addFiles = useCallback((files: File[] | FileList): string[] => {
    operationRef.current += 1;
    const result = addImageFiles(attachmentsRef.current, files);
    attachmentsRef.current = result.attachments;
    setAttachments(result.attachments);
    return result.errors;
  }, []);

  const remove = useCallback((uid: string) => {
    operationRef.current += 1;
    const removed = attachmentsRef.current.find((item) => item.uid === uid);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    const next = attachmentsRef.current.filter((item) => item.uid !== uid);
    attachmentsRef.current = next;
    setAttachments(next);
  }, []);

  const replaceFromResolved = useCallback(
    async (
      resolver: () => Promise<ResolveImageAttachmentsResult>,
    ): Promise<RestoreImageDraftsResult> => {
      const operation = operationRef.current + 1;
      const startingScope = scopeRef.current;
      operationRef.current = operation;
      const result = await resolver();

      if (
        !mountedRef.current ||
        operationRef.current !== operation ||
        scopeRef.current !== startingScope
      ) {
        return { ok: false, cancelled: true };
      }

      if (!result.ok) {
        return { ok: false, missing: result.missing };
      }

      replace(createDraftAttachments(result.sources));
      return { ok: true };
    },
    [replace],
  );

  const restoreMessageAttachments = useCallback(
    (items: MessageImageAttachment[] = []) =>
      replaceFromResolved(() => resolveMessageImageAttachments(items)),
    [replaceFromResolved],
  );

  const restoreAssistantImage = useCallback(
    (message: AssistantMessage) =>
      replaceFromResolved(() => resolveAssistantImageAttachment(message)),
    [replaceFromResolved],
  );

  useEffect(() => {
    if (scopeRef.current === scopeKey) {
      return;
    }

    scopeRef.current = scopeKey;
    clear();
  }, [clear, scopeKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      revokeDraftAttachmentPreviews(attachmentsRef.current);
    };
  }, []);

  return {
    attachments,
    sources: attachments as ImageAttachmentSource[],
    addFiles,
    remove,
    clear,
    restoreMessageAttachments,
    restoreAssistantImage,
  };
}
