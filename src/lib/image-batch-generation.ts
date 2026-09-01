import { requestEditedImage, requestGeneratedImage } from "./api";
import {
  prepareImageAttachments,
  type PreparedImageAttachments,
} from "./image-attachments";
import {
  isImageBatchAbortError,
  runImageBatch,
  type ImageBatchTaskResult,
} from "./image-batch";
import {
  appendImageCanvasConstraint,
  inspectGeneratedImageAspect,
} from "./image-aspect";
import {
  base64ToBlob,
  saveGeneratedImage,
} from "./studio-db";
import { createId } from "./conversations";
import type {
  AssistantMessage,
  GenerateImageResponse,
  GenerationRequestSettings,
  GenerationSnapshot,
  ImageAttachmentSource,
} from "../types";
import { IMAGE_BATCH_CONCURRENCY } from "../types";

export interface ImageBatchGenerationOptions {
  prompts: string[];
  batchId: string;
  quantity: number;
  requestSettings: GenerationRequestSettings;
  requestSnapshot: GenerationSnapshot;
  attachmentSources: ImageAttachmentSource[];
  storageAvailable: boolean;
  createdAt: number;
  signal: AbortSignal;
  onPrepared: (
    assistants: AssistantMessage[],
    prepared: PreparedImageAttachments,
  ) => void | Promise<void>;
  onUpdate: (assistantId: string, patch: Partial<AssistantMessage>) => void;
  onStorageWarning: (kind: "input" | "output") => void;
}

export interface ImageBatchGenerationResult {
  assistants: AssistantMessage[];
  prepared: PreparedImageAttachments;
  results: ImageBatchTaskResult<GenerateImageResponse>[];
  successfulCount: number;
  failedCount: number;
  cancelledCount: number;
}

export async function runImageGenerationBatch(
  options: ImageBatchGenerationOptions,
): Promise<ImageBatchGenerationResult> {
  if (options.prompts.length !== options.quantity) {
    throw new Error("批量生成提示词数量与图片数量不一致。");
  }
  const assistants = Array.from(
    { length: options.quantity },
    (_, index): AssistantMessage => ({
      id: createId("assistant"),
      type: "assistant",
      prompt: options.prompts[index]!,
      request: options.requestSnapshot,
      status: "loading",
      createdAt: options.createdAt + index + 1,
      batchId: options.batchId,
      batchIndex: index,
      batchSize: options.quantity,
    }),
  );
  const prepared = await prepareImageAttachments(
    options.attachmentSources,
    options.storageAvailable,
    options.createdAt,
  );

  if (prepared.persistenceFailed) {
    options.onStorageWarning("input");
  }
  await options.onPrepared(assistants, prepared);

  const requestImage = (
    prompt: string,
    signal: AbortSignal,
  ): Promise<GenerateImageResponse> => {
    const requestPrompt = appendImageCanvasConstraint(
      prompt,
      options.requestSettings.size,
    );
    return prepared.requestAttachments.length
      ? requestEditedImage(
          options.requestSettings,
          requestPrompt,
          prepared.requestAttachments,
          signal,
        )
      : requestGeneratedImage(options.requestSettings, requestPrompt, signal);
  };
  let canPersist = options.storageAvailable && !prepared.persistenceFailed;
  let outputWarningShown = false;
  const finalizeSuccess = async (
    assistant: AssistantMessage,
    response: GenerateImageResponse,
  ) => {
    const imageDataUrl = `data:${response.mimeType};base64,${response.image}`;
    const inspection = await inspectGeneratedImageAspect(
      imageDataUrl,
      options.requestSettings.size,
    );
    let imageStored = false;
    if (canPersist) {
      try {
        await saveGeneratedImage(
          assistant.id,
          base64ToBlob(response.image, response.mimeType),
          response.mimeType,
          assistant.createdAt,
        );
        imageStored = true;
      } catch {
        canPersist = false;
        if (!outputWarningShown) {
          outputWarningShown = true;
          options.onStorageWarning("output");
        }
      }
    }

    options.onUpdate(assistant.id, {
      status: "success",
      ...(imageStored ? { imageId: assistant.id } : { imageDataUrl }),
      mimeType: response.mimeType,
      revisedPrompt: response.revisedPrompt,
      source: response.source,
      aspectStatus: inspection.status,
      ...(inspection.width && inspection.height
        ? { actualWidth: inspection.width, actualHeight: inspection.height }
        : {}),
    });
  };

  const finalizeFailure = (assistant: AssistantMessage, reason: unknown) => {
    const aborted = options.signal.aborted || isImageBatchAbortError(reason);
    options.onUpdate(assistant.id, {
      status: aborted ? "aborted" : "error",
      error: aborted
        ? "请求已由你停止。"
        : reason instanceof Error
          ? reason.message
          : "未知错误，请检查连接设置后重试。",
    });
  };

  const settledResults = await runImageBatch(
    assistants.map((assistant) => (signal) => requestImage(assistant.prompt, signal)),
    {
      signal: options.signal,
      concurrency: IMAGE_BATCH_CONCURRENCY,
      onSettled: async (result) => {
        const assistant = assistants[result.index];
        if (!assistant) return;
        if (result.status !== "fulfilled" || !result.value) {
          finalizeFailure(assistant, result.reason);
          return;
        }
        await finalizeSuccess(assistant, result.value);
      },
    },
  );

  let successfulCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  for (const result of settledResults) {
    if (result.status === "fulfilled") {
      successfulCount += 1;
    } else if (options.signal.aborted || isImageBatchAbortError(result.reason)) {
      cancelledCount += 1;
    } else {
      failedCount += 1;
    }
  }

  return {
    assistants,
    prepared,
    results: settledResults,
    successfulCount,
    failedCount,
    cancelledCount,
  };
}
