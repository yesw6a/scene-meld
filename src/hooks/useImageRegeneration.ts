import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { requestEditedImage, requestGeneratedImage } from "../lib/api";
import { createId } from "../lib/conversations";
import {
  appendImageCanvasConstraint,
  inspectGeneratedImageAspect,
} from "../lib/image-aspect";
import { buildStoryboardGenerationPrompt } from "../lib/storyboard-generation";
import {
  base64ToBlob,
  dataUrlToBlob,
  loadGeneratedImage,
  saveGeneratedImage,
} from "../lib/studio-db";
import type {
  AssistantMessage,
  GeneratedImageVersion,
  GenerationRequestSettings,
  GenerationSettings,
  ImageAttachmentSource,
  UserMessage,
} from "../types";

type SettledConnectionStatus = "ready" | "success" | "error";

interface ToastApi {
  error: (content: string) => unknown;
  warning: (content: string) => unknown;
}

export interface ImageRetryState {
  messageId: string;
  status: "retrying" | "failed" | "cancelled";
  detail?: string;
}

export interface RetryImageContext {
  conversationId: string;
  message: AssistantMessage;
  source?: UserMessage;
  siblings: AssistantMessage[];
  attachmentSources: ImageAttachmentSource[];
}

interface UseImageRegenerationOptions {
  settings: GenerationSettings;
  isGenerating: boolean;
  requestRef: MutableRefObject<AbortController | null>;
  storageAvailable: boolean;
  toast: ToastApi;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setStorageAvailable: Dispatch<SetStateAction<boolean>>;
  setLastConnectionStatus: Dispatch<SetStateAction<SettledConnectionStatus>>;
  updateAssistantMessage: (
    conversationId: string,
    assistantId: string,
    patch: Partial<AssistantMessage>,
  ) => void;
}

export default function useImageRegeneration(options: UseImageRegenerationOptions) {
  const [retryState, setRetryState] = useState<ImageRetryState | null>(null);

  const regenerate = useCallback(async (context: RetryImageContext) => {
    const { message } = context;
    if (options.isGenerating || options.requestRef.current) {
      return;
    }
    if (message.comparison) {
      options.toast.warning("请先在上一版和新版本之间完成选择，再次重试。");
      return;
    }

    const controller = new AbortController();
    options.requestRef.current = controller;
    options.setIsGenerating(true);
    setRetryState({ messageId: message.id, status: "retrying" });

    try {
      const retryRequest = await createRetryRequest(context, options.settings);
      if (retryRequest.continuityMissing) {
        options.toast.warning("上一镜头图片暂时无法读取，本次将仅按分镜文字继续重试。");
      }

      const response = retryRequest.attachments.length
        ? await requestEditedImage(
            retryRequest.settings,
            retryRequest.prompt,
            retryRequest.attachments,
            controller.signal,
          )
        : await requestGeneratedImage(
            retryRequest.settings,
            retryRequest.prompt,
            controller.signal,
          );
      const imageDataUrl = `data:${response.mimeType};base64,${response.image}`;
      const inspection = await inspectGeneratedImageAspect(
        imageDataUrl,
        retryRequest.settings.size,
      );
      const candidateId = createId("candidate");
      const candidateBlob = base64ToBlob(response.image, response.mimeType);
      let candidateStored = false;

      if (options.storageAvailable) {
        try {
          await saveGeneratedImage(candidateId, candidateBlob, response.mimeType, Date.now());
          candidateStored = true;
        } catch {
          options.setStorageAvailable(false);
          options.toast.warning(
            "新版本已生成，但无法保存到本地；这个版本仅在当前会话有效。关闭页面或应用前，请完成取舍并下载要保留的图片。",
          );
        }
      }

      const candidate: GeneratedImageVersion = {
        id: candidateId,
        createdAt: Date.now(),
        ...(candidateStored ? { imageId: candidateId } : { imageDataUrl }),
        mimeType: response.mimeType,
        revisedPrompt: response.revisedPrompt,
        source: response.source,
        aspectStatus: inspection.status,
        ...(inspection.width && inspection.height
          ? { actualWidth: inspection.width, actualHeight: inspection.height }
          : {}),
      };

      options.updateAssistantMessage(context.conversationId, message.id, {
        comparison: { candidate },
      });
      options.setLastConnectionStatus("success");
      setRetryState(null);
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
      const detail = aborted
        ? "已停止重试，上一版已保留。"
        : error instanceof Error
          ? error.message
          : "重试失败，上一版已保留。";
      setRetryState({
        messageId: message.id,
        status: aborted ? "cancelled" : "failed",
        detail,
      });
      if (!aborted) {
        options.setLastConnectionStatus("error");
        options.toast.error(detail);
      }
    } finally {
      if (options.requestRef.current === controller) {
        options.requestRef.current = null;
      }
      options.setIsGenerating(false);
    }
  }, [options]);

  const chooseComparison = useCallback((
    conversationId: string,
    message: AssistantMessage,
    choice: "previous" | "candidate",
  ) => {
    const candidate = message.comparison?.candidate;
    if (!candidate) {
      return;
    }

    if (choice === "previous") {
      options.updateAssistantMessage(conversationId, message.id, { comparison: undefined });
      return;
    }

    options.updateAssistantMessage(conversationId, message.id, {
      imageId: candidate.imageId,
      imageDataUrl: candidate.imageDataUrl,
      mimeType: candidate.mimeType,
      revisedPrompt: candidate.revisedPrompt,
      source: candidate.source,
      aspectStatus: candidate.aspectStatus,
      actualWidth: candidate.actualWidth,
      actualHeight: candidate.actualHeight,
      comparison: undefined,
    });
  }, [options]);

  return { retryState, regenerate, chooseComparison };
}

async function createRetryRequest(
  context: RetryImageContext,
  settings: GenerationSettings,
): Promise<{
  settings: GenerationRequestSettings;
  prompt: string;
  attachments: ImageAttachmentSource[];
  continuityMissing: boolean;
}> {
  const requestSettings: GenerationRequestSettings = {
    ...settings,
    ...context.message.request,
    size: context.message.request.size,
    quality: context.message.request.quality,
    quantity: 1,
    mode: "single",
  };
  const plan = context.source?.storyboardPlan;
  const shotIndex = context.message.shotIndex;

  if (!plan || shotIndex === undefined) {
    return {
      settings: requestSettings,
      prompt: appendImageCanvasConstraint(context.message.prompt, requestSettings.size),
      attachments: context.attachmentSources,
      continuityMissing: false,
    };
  }

  if (shotIndex === 0) {
    return {
      settings: requestSettings,
      prompt: buildStoryboardGenerationPrompt(plan, shotIndex, requestSettings.size),
      attachments: context.attachmentSources,
      continuityMissing: false,
    };
  }

  const previous = [...context.siblings]
    .filter((item) =>
      item.status === "success" &&
      item.shotIndex !== undefined &&
      item.shotIndex < shotIndex,
    )
    .sort((left, right) => (right.shotIndex ?? -1) - (left.shotIndex ?? -1))[0];
  const previousAttachment = previous ? await assistantAttachment(previous) : null;
  const previousDescription = previous?.shotIndex === undefined
    ? ""
    : plan.shots[previous.shotIndex]?.description ?? "";

  return {
    settings: requestSettings,
    prompt: buildStoryboardGenerationPrompt(
      plan,
      shotIndex,
      requestSettings.size,
      previousDescription,
    ),
    attachments: previousAttachment ? [previousAttachment] : [],
    continuityMissing: !previousAttachment,
  };
}

async function assistantAttachment(message: AssistantMessage): Promise<ImageAttachmentSource | null> {
  let blob: Blob | null = null;
  if (message.imageId) {
    blob = await loadGeneratedImage(message.imageId);
  } else if (message.imageDataUrl) {
    blob = await dataUrlToBlob(message.imageDataUrl);
  }
  if (!blob) {
    return null;
  }

  const mimeType = message.mimeType || blob.type || "image/png";
  return {
    imageId: message.imageId,
    name: `storyboard-reference.${mimeType.split("/")[1] || "png"}`,
    mimeType,
    size: blob.size,
    blob,
    persisted: Boolean(message.imageId),
  };
}
