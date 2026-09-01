import { requestEditedImage, requestGeneratedImage } from "./api";
import {
  appendImageCanvasConstraint,
  inspectGeneratedImageAspect,
} from "./image-aspect";
import { prepareImageAttachments, type PreparedImageAttachments } from "./image-attachments";
import { base64ToBlob, saveGeneratedImage } from "./studio-db";
import { createId } from "./conversations";
import type {
  AssistantMessage,
  GenerateImageResponse,
  GenerationRequestSettings,
  GenerationSnapshot,
  ImageAttachmentSource,
  StoryboardPlan,
} from "../types";

export interface StoryboardGenerationOptions {
  plan: StoryboardPlan;
  batchId: string;
  requestSettings: GenerationRequestSettings;
  requestSnapshot: GenerationSnapshot;
  attachmentSources: ImageAttachmentSource[];
  storageAvailable: boolean;
  createdAt: number;
  signal: AbortSignal;
  onPrepared: (assistants: AssistantMessage[], prepared: PreparedImageAttachments) => void | Promise<void>;
  onUpdate: (assistantId: string, patch: Partial<AssistantMessage>) => void;
  onStorageWarning: (kind: "input" | "output") => void;
}

export async function runStoryboardGeneration(
  options: StoryboardGenerationOptions,
): Promise<{ successfulCount: number; failedCount: number; cancelledCount: number }> {
  const assistants = options.plan.shots.map((shot, index) => ({
    id: createId("assistant"),
    type: "assistant" as const,
    prompt: shot.imagePrompt,
    request: options.requestSnapshot,
    status: "loading" as const,
    createdAt: options.createdAt + index + 1,
    batchId: options.batchId,
    batchIndex: index,
    batchSize: options.plan.shots.length,
    shotId: shot.id,
    shotIndex: index,
    shotTitle: shot.title,
  }));
  const prepared = await prepareImageAttachments(
    options.attachmentSources,
    options.storageAvailable,
    options.createdAt,
  );
  if (prepared.persistenceFailed) options.onStorageWarning("input");
  await options.onPrepared(assistants, prepared);

  let successfulCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let previousDescription = "";
  let previousAttachment: ImageAttachmentSource | null = null;
  let canPersist = options.storageAvailable && !prepared.persistenceFailed;
  for (let index = 0; index < options.plan.shots.length; index += 1) {
    const assistant = assistants[index];
    const shot = options.plan.shots[index];
    if (!assistant || !shot) continue;
    if (options.signal.aborted) {
      options.onUpdate(assistant.id, { status: "aborted", error: "请求已由你停止。" });
      cancelledCount += 1;
      continue;
    }
    const prompt = appendImageCanvasConstraint(
      [
        options.plan.styleBible,
        shot.imagePrompt,
        `镜头 ${index + 1}：${shot.title}`,
        `机位：${shot.camera}`,
        `动作：${shot.action}`,
        `连续性：${shot.continuityNotes}`,
        previousDescription ? `上一镜头连续参考：${previousDescription}` : "",
      ].filter(Boolean).join("\n"),
      options.requestSettings.size,
    );
    try {
      const continuityAttachments: ImageAttachmentSource[] = index === 0
        ? prepared.requestAttachments
        : previousAttachment
          ? [previousAttachment]
          : [];
      const response: GenerateImageResponse = continuityAttachments.length
        ? await requestEditedImage(options.requestSettings, prompt, continuityAttachments, options.signal)
        : await requestGeneratedImage(options.requestSettings, prompt, options.signal);
      const imageDataUrl = `data:${response.mimeType};base64,${response.image}`;
      const inspection = await inspectGeneratedImageAspect(
        imageDataUrl,
        options.requestSettings.size,
      );
      let imageStored = false;
      if (canPersist) {
        try {
          await saveGeneratedImage(assistant.id, base64ToBlob(response.image, response.mimeType), response.mimeType, assistant.createdAt);
          imageStored = true;
        } catch {
          canPersist = false;
          options.onStorageWarning("output");
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
      previousDescription = shot.description;
      previousAttachment = {
        name: `storyboard-shot-${index + 1}.${response.mimeType.split("/")[1] || "png"}`,
        mimeType: response.mimeType,
        size: Math.floor((response.image.length * 3) / 4),
        blob: base64ToBlob(response.image, response.mimeType),
        persisted: imageStored,
      };
      successfulCount += 1;
    } catch (error) {
      const aborted = options.signal.aborted || (error instanceof Error && error.name === "AbortError");
      options.onUpdate(assistant.id, {
        status: aborted ? "aborted" : "error",
        error: aborted ? "请求已由你停止。" : error instanceof Error ? error.message : "分镜生成失败。",
      });
      if (aborted) cancelledCount += 1;
      else failedCount += 1;
    }
  }
  return { successfulCount, failedCount, cancelledCount };
}
