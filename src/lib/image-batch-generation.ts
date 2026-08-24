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
  type ImageAspectInspection,
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
  prompt: string;
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

interface MismatchedImageResult {
  index: number;
  assistant: AssistantMessage;
  response: GenerateImageResponse;
  inspection: ImageAspectInspection;
}

export async function runImageGenerationBatch(
  options: ImageBatchGenerationOptions,
): Promise<ImageBatchGenerationResult> {
  const assistants = Array.from(
    { length: options.quantity },
    (_, index): AssistantMessage => ({
      id: createId("assistant"),
      type: "assistant",
      prompt: options.prompt,
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

  const requestPrompt = appendImageCanvasConstraint(
    options.prompt,
    options.requestSettings.size,
  );
  const requestImage = (signal: AbortSignal): Promise<GenerateImageResponse> =>
    prepared.requestAttachments.length
      ? requestEditedImage(
          options.requestSettings,
          requestPrompt,
          prepared.requestAttachments,
          signal,
        )
      : requestGeneratedImage(options.requestSettings, requestPrompt, signal);
  let canPersist = options.storageAvailable && !prepared.persistenceFailed;
  let outputWarningShown = false;
  const results: Array<ImageBatchTaskResult<GenerateImageResponse> | undefined> = Array.from(
    { length: assistants.length },
    () => undefined,
  );

  const finalizeSuccess = async (
    assistant: AssistantMessage,
    response: GenerateImageResponse,
    inspection: ImageAspectInspection,
    aspectRetried = false,
  ) => {
    let imageStored = false;
    const imageDataUrl = `data:${response.mimeType};base64,${response.image}`;
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
      ...(aspectRetried ? { aspectRetried: true } : {}),
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

  const retryMismatchedResult = async ({
    assistant,
    response,
    inspection,
  }: MismatchedImageResult) => {
    if (options.signal.aborted) {
      await finalizeSuccess(assistant, response, inspection);
      return;
    }

    options.onUpdate(assistant.id, {
      aspectStatus: "retrying",
      aspectRetried: true,
    });

    try {
      const retryResponse = await requestImage(options.signal);
      const retryDataUrl = `data:${retryResponse.mimeType};base64,${retryResponse.image}`;
      const retryInspection = await inspectGeneratedImageAspect(
        retryDataUrl,
        options.requestSettings.size,
      );
      if (retryInspection.status !== "mismatched") {
        await finalizeSuccess(assistant, retryResponse, retryInspection, true);
        return;
      }
    } catch {
      // Preserve the first complete image when the one allowed recovery request fails.
    }

    await finalizeSuccess(assistant, response, inspection, true);
  };

  let nextIndex = 0;
  let serialMode = false;
  while (nextIndex < assistants.length) {
    if (options.signal.aborted) {
      break;
    }

    const roundSize = Math.min(
      serialMode ? 1 : IMAGE_BATCH_CONCURRENCY,
      assistants.length - nextIndex,
    );
    const roundIndexes = Array.from(
      { length: roundSize },
      (_, offset) => nextIndex + offset,
    );
    nextIndex += roundSize;
    const mismatches = new Map<number, MismatchedImageResult>();

    await runImageBatch(
      roundIndexes.map(() => requestImage),
      {
        signal: options.signal,
        concurrency: roundSize,
        onSettled: async (roundResult) => {
          const index = roundIndexes[roundResult.index];
          const assistant = index === undefined ? undefined : assistants[index];
          if (index === undefined || !assistant) {
            return;
          }

          results[index] = { ...roundResult, index };
          if (roundResult.status !== "fulfilled" || !roundResult.value) {
            finalizeFailure(assistant, roundResult.reason);
            return;
          }

          const response = roundResult.value;
          const imageDataUrl = `data:${response.mimeType};base64,${response.image}`;
          const inspection = await inspectGeneratedImageAspect(
            imageDataUrl,
            options.requestSettings.size,
          );
          if (inspection.status === "mismatched" && !options.signal.aborted) {
            mismatches.set(index, { index, assistant, response, inspection });
            options.onUpdate(assistant.id, { aspectStatus: "retrying" });
            return;
          }

          await finalizeSuccess(assistant, response, inspection);
        },
      },
    );

    if (mismatches.size > 0) {
      serialMode = true;
      const orderedMismatches = [...mismatches.values()].sort(
        (left, right) => left.index - right.index,
      );
      for (const mismatch of orderedMismatches) {
        await retryMismatchedResult(mismatch);
      }
    }
  }

  if (options.signal.aborted) {
    for (let index = nextIndex; index < assistants.length; index += 1) {
      const assistant = assistants[index];
      const reason = createBatchAbortError();
      results[index] = { index, status: "rejected", reason };
      finalizeFailure(assistant, reason);
    }
  }

  const settledResults = results.map(
    (result, index): ImageBatchTaskResult<GenerateImageResponse> =>
      result ?? { index, status: "rejected", reason: createBatchAbortError() },
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

function createBatchAbortError(): Error {
  const error = new Error("The image batch was cancelled.");
  error.name = "AbortError";
  return error;
}
