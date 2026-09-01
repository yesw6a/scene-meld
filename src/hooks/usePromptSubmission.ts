import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { requestEditedImage, requestGeneratedImage } from "../lib/api";
import { runImageGenerationBatch } from "../lib/image-batch-generation";
import { planImagePrompts } from "../lib/image-prompt-planner";
import { planStoryboard } from "../lib/conversation-api";
import { createId, titleForSubmittedPrompt } from "../lib/conversations";
import { resolveGenerationSubmission } from "../lib/generation-plan";
import {
  appendImageCanvasConstraint,
  inspectGeneratedImageAspect,
} from "../lib/image-aspect";
import { prepareImageAttachments } from "../lib/image-attachments";
import { parsePromptDirectives } from "../lib/prompt-directives";
import { runStoryboardGeneration } from "../lib/storyboard-generation";
import { base64ToBlob, saveGeneratedImage } from "../lib/studio-db";
import {
  IMAGE_MODEL,
  type AssistantMessage,
  type Conversation,
  type GenerationRequestSettings,
  type GenerationSettings,
  type GenerationSnapshot,
  type ImageAttachmentSource,
  type StoryboardPlan,
  type WorkspaceSnapshot,
} from "../types";

type SettledConnectionStatus = "ready" | "success" | "error";

interface ToastApi {
  error: (content: string) => unknown;
  warning: (content: string) => unknown;
  info: (content: string) => unknown;
}

interface UsePromptSubmissionOptions {
  workspace: WorkspaceSnapshot | null;
  activeConversation: Conversation | null;
  settings: GenerationSettings;
  configured: boolean;
  isGenerating: boolean;
  requestRef: MutableRefObject<AbortController | null>;
  draftImageSources: ImageAttachmentSource[];
  storageAvailable: boolean;
  toast: ToastApi;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setStorageAvailable: Dispatch<SetStateAction<boolean>>;
  setLastConnectionStatus: Dispatch<SetStateAction<SettledConnectionStatus>>;
  setDraft: Dispatch<SetStateAction<string>>;
  clearDraftImages: () => void;
  openConnectionSettings: () => void;
  reviewStoryboardPlan: (plan: StoryboardPlan) => Promise<StoryboardPlan | null>;
  updateConversation: (conversationId: string, update: (conversation: Conversation) => Conversation) => void;
  updateAssistantMessage: (conversationId: string, assistantId: string, patch: Partial<AssistantMessage>) => void;
}

export default function usePromptSubmission(options: UsePromptSubmissionOptions) {
  return useCallback(
    async (
      rawPrompt: string,
      snapshotOverride?: GenerationSnapshot,
      conversationIdOverride?: string,
      attachmentSourcesOverride?: ImageAttachmentSource[],
    ) => {
      const originalPrompt = rawPrompt.trim();
      const targetConversation = conversationIdOverride
        ? options.workspace?.conversations.find((item) => item.id === conversationIdOverride)
        : options.activeConversation;
      if (!originalPrompt || options.isGenerating || options.requestRef.current || !targetConversation) return;
      if (originalPrompt.length > 20_000) {
        options.toast.error("提示词不能超过 20,000 个字符。");
        return;
      }

      const directiveResult = snapshotOverride
        ? {
            cleanPrompt: originalPrompt,
            settingsPatch: {},
            directives: [],
            errors: [],
            errorsByKey: {},
          }
        : parsePromptDirectives(originalPrompt);
      if (directiveResult.errors.length) {
        options.toast.error(directiveResult.errors[0]!);
        return;
      }
      const prompt = directiveResult.cleanPrompt;
      if (!options.configured) {
        options.openConnectionSettings();
        options.toast.warning("请先填写 API 基础地址与 API Key。");
        return;
      }

      const conversationId = targetConversation.id;
      const userId = createId("user");
      const assistantId = createId("assistant");
      const now = Date.now();
      const attachmentSources = attachmentSourcesOverride ?? options.draftImageSources;
      const resolved = snapshotOverride
        ? null
        : resolveGenerationSubmission(options.settings, directiveResult);
      const requestSnapshot: GenerationSnapshot = snapshotOverride
        ? { ...snapshotOverride, quantity: 1, mode: "single" }
        : {
            model: IMAGE_MODEL,
            size: resolved!.settings.size,
            quality: resolved!.settings.quality,
            quantity: resolved!.plan.mode === "batch" ? resolved!.plan.count : 1,
            mode: resolved!.plan.mode,
            storyboardQuantity:
              resolved!.plan.mode === "storyboard"
                ? resolved!.plan.shotCount
                : resolved!.settings.storyboardQuantity,
          };
      const requestSettings: GenerationRequestSettings = {
        ...options.settings,
        ...(resolved?.settings ?? requestSnapshot),
        ...requestSnapshot,
      };
      const plan = resolved?.plan ?? { mode: "single" as const, count: 1 as const };

      if (plan.mode === "storyboard") {
        await submitStoryboard({
          options, originalPrompt, prompt, conversationId, userId, now, attachmentSources,
          attachmentSourcesOverride, requestSnapshot, requestSettings,
        });
        return;
      }
      if (plan.mode === "batch") {
        await submitBatch({
          options, originalPrompt, prompt, conversationId, userId, now, attachmentSources,
          attachmentSourcesOverride, requestSnapshot, requestSettings, quantity: plan.count,
        });
        return;
      }
      await submitSingle({
        options, originalPrompt, prompt, conversationId, userId, assistantId, now,
        attachmentSources, attachmentSourcesOverride, requestSnapshot, requestSettings,
      });
    },
    [options],
  );
}

interface SubmissionContext {
  options: UsePromptSubmissionOptions;
  originalPrompt: string;
  prompt: string;
  conversationId: string;
  userId: string;
  now: number;
  attachmentSources: ImageAttachmentSource[];
  attachmentSourcesOverride?: ImageAttachmentSource[];
  requestSnapshot: GenerationSnapshot;
  requestSettings: GenerationRequestSettings;
}

async function submitStoryboard(context: SubmissionContext): Promise<void> {
  const { options } = context;
  const batchId = createId("storyboard");
  const controller = new AbortController();
  let storageWarningShown = false;
  options.requestRef.current = controller;
  options.setIsGenerating(true);
  try {
    let plan: StoryboardPlan;
    try {
      plan = await planStoryboard(
        context.requestSettings.conversation,
        context.prompt,
        context.requestSnapshot.storyboardQuantity ?? "auto",
        context.attachmentSources,
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) throw error;
      options.toast.warning("对话 AI 规划失败，已切换为基础分镜模板。 ");
      plan = await planStoryboard(
        {
          ...context.requestSettings.conversation,
          planningScopes: {
            ...context.requestSettings.conversation.planningScopes,
            storyboard: false,
          },
        },
        context.prompt,
        context.requestSnapshot.storyboardQuantity ?? "auto",
        context.attachmentSources,
        controller.signal,
      );
    }
    const reviewedPlan = await options.reviewStoryboardPlan(plan);
    if (!reviewedPlan || controller.signal.aborted) {
      if (!controller.signal.aborted) {
        options.toast.info("已取消分镜生成，提示词和参考图仍保留在输入框中。");
      }
      return;
    }
    plan = reviewedPlan;
    const outcome = await runStoryboardGeneration({
      plan,
      batchId,
      requestSettings: context.requestSettings,
      requestSnapshot: context.requestSnapshot,
      attachmentSources: context.attachmentSources,
      storageAvailable: options.storageAvailable,
      createdAt: context.now,
      signal: controller.signal,
      onPrepared: (assistants, prepared) => {
        options.updateConversation(context.conversationId, (conversation) => ({
          ...conversation,
          title: titleForSubmittedPrompt(conversation, context.originalPrompt),
          messages: [...conversation.messages, {
            id: context.userId,
            type: "user",
            prompt: context.originalPrompt,
            createdAt: context.now,
            batchId,
            storyboardPlan: plan,
            ...(prepared.messageAttachments.length ? { attachments: prepared.messageAttachments } : {}),
          }, ...assistants],
          updatedAt: context.now,
        }));
        clearDraftIfCurrent(context);
      },
      onUpdate: (messageId, patch) => options.updateAssistantMessage(context.conversationId, messageId, patch),
      onStorageWarning: (kind) => {
        if (storageWarningShown) return;
        storageWarningShown = true;
        options.setStorageAvailable(false);
        options.toast.warning(kind === "input" ? "参考图可用于本次请求，但无法保存到本地。" : "图片已生成，但无法保存到本地。");
      },
    });
    options.setLastConnectionStatus(outcome.successfulCount > 0 ? "success" : outcome.failedCount > 0 ? "error" : "ready");
  } catch (error) {
    if (!controller.signal.aborted) {
      options.setLastConnectionStatus("error");
      options.toast.error(error instanceof Error ? error.message : "分镜生成失败。 ");
    }
  } finally {
    finishRequest(options, controller);
  }
}

async function submitBatch(context: SubmissionContext & { quantity: number }): Promise<void> {
  const { options } = context;
  const batchId = createId("batch");
  const controller = new AbortController();
  let storageWarningShown = false;
  options.requestRef.current = controller;
  options.setIsGenerating(true);
  try {
    const prompts = await resolveImagePrompts(
      context,
      "batch",
      context.quantity,
      controller.signal,
    );
    const outcome = await runImageGenerationBatch({
      prompts,
      batchId,
      quantity: context.quantity,
      requestSettings: context.requestSettings,
      requestSnapshot: context.requestSnapshot,
      attachmentSources: context.attachmentSources,
      storageAvailable: options.storageAvailable,
      createdAt: context.now,
      signal: controller.signal,
      onPrepared: (assistants, prepared) => {
        options.updateConversation(context.conversationId, (conversation) => ({
          ...conversation,
          title: titleForSubmittedPrompt(conversation, context.originalPrompt),
          messages: [...conversation.messages, {
            id: context.userId,
            type: "user",
            prompt: context.originalPrompt,
            createdAt: context.now,
            batchId,
            ...(prepared.messageAttachments.length ? { attachments: prepared.messageAttachments } : {}),
          }, ...assistants],
          updatedAt: context.now,
        }));
        clearDraftIfCurrent(context);
      },
      onUpdate: (messageId, patch) => options.updateAssistantMessage(context.conversationId, messageId, patch),
      onStorageWarning: (kind) => {
        if (storageWarningShown) return;
        storageWarningShown = true;
        options.setStorageAvailable(false);
        options.toast.warning(kind === "input"
          ? "参考图仍可用于本次请求，但无法保存到本地；刷新页面后可能无法再次编辑。"
          : "图片已生成，但无法保存到本地。请在关闭页面前下载图片。");
      },
    });
    options.setLastConnectionStatus(outcome.successfulCount > 0
      ? "success"
      : outcome.failedCount > 0 ? "error" : "ready");
  } catch (error) {
    if (!controller.signal.aborted) {
      options.setLastConnectionStatus("error");
      options.toast.error(error instanceof Error ? error.message : "多图生成无法启动，请检查连接设置后重试。");
    }
  } finally {
    finishRequest(options, controller);
  }
}

async function submitSingle(context: SubmissionContext & { assistantId: string }): Promise<void> {
  const { options } = context;
  const controller = new AbortController();
  options.requestRef.current = controller;
  options.setIsGenerating(true);
  let assistantCreated = false;
  try {
    const plannedPrompts = await resolveImagePrompts(
      context,
      "single",
      1,
      controller.signal,
    );
    const executionPrompt = plannedPrompts[0] ?? context.prompt;
    const prepared = await prepareImageAttachments(
      context.attachmentSources,
      options.storageAvailable,
      context.now,
    );
    if (prepared.persistenceFailed) {
      options.setStorageAvailable(false);
      options.toast.warning("参考图仍可用于本次请求，但无法保存到本地；刷新页面后可能无法再次编辑。");
    }
    options.updateConversation(context.conversationId, (conversation) => ({
      ...conversation,
      title: titleForSubmittedPrompt(conversation, context.originalPrompt),
      messages: [...conversation.messages, {
        id: context.userId,
        type: "user",
        prompt: context.originalPrompt,
        createdAt: context.now,
        ...(prepared.messageAttachments.length ? { attachments: prepared.messageAttachments } : {}),
      }, {
        id: context.assistantId,
        type: "assistant",
        prompt: executionPrompt,
        request: context.requestSnapshot,
        status: "loading",
        createdAt: context.now + 1,
      }],
      updatedAt: context.now,
    }));
    assistantCreated = true;
    clearDraftIfCurrent(context);
    const requestPrompt = appendImageCanvasConstraint(
      executionPrompt,
      context.requestSettings.size,
    );
    const result = prepared.requestAttachments.length
      ? await requestEditedImage(context.requestSettings, requestPrompt, prepared.requestAttachments, controller.signal)
      : await requestGeneratedImage(context.requestSettings, requestPrompt, controller.signal);
    const imageDataUrl = `data:${result.mimeType};base64,${result.image}`;
    const inspection = await inspectGeneratedImageAspect(
      imageDataUrl,
      context.requestSettings.size,
    );
    let imageStored = false;
    if (options.storageAvailable) {
      try {
        await saveGeneratedImage(context.assistantId, base64ToBlob(result.image, result.mimeType), result.mimeType, context.now + 1);
        imageStored = true;
      } catch {
        options.setStorageAvailable(false);
        options.toast.warning("图片已生成，但无法保存到本地。请在关闭页面前下载图片。");
      }
    }
    options.updateAssistantMessage(context.conversationId, context.assistantId, {
      status: "success",
      ...(imageStored ? { imageId: context.assistantId } : { imageDataUrl }),
      mimeType: result.mimeType,
      revisedPrompt: result.revisedPrompt,
      source: result.source,
      aspectStatus: inspection.status,
      ...(inspection.width && inspection.height
        ? { actualWidth: inspection.width, actualHeight: inspection.height }
        : {}),
    });
    options.setLastConnectionStatus("success");
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    const errorMessage = aborted
      ? "请求已由你停止。"
      : error instanceof Error
        ? error.message
        : "未知错误，请检查连接设置后重试。";
    if (assistantCreated) {
      options.updateAssistantMessage(context.conversationId, context.assistantId, {
        status: aborted ? "aborted" : "error",
        error: errorMessage,
      });
    } else if (!aborted) {
      options.toast.error(errorMessage);
    }
    if (!aborted) options.setLastConnectionStatus("error");
  } finally {
    finishRequest(options, controller);
  }
}

async function resolveImagePrompts(
  context: SubmissionContext,
  mode: "single" | "batch",
  count: number,
  signal: AbortSignal,
): Promise<string[]> {
  if (!context.requestSettings.conversation.planningScopes[mode]) {
    return Array.from({ length: count }, () => context.prompt);
  }

  try {
    const plan = await planImagePrompts(
      context.requestSettings.conversation,
      context.prompt,
      count,
      context.attachmentSources,
      signal,
    );
    return plan.prompts;
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    context.options.toast.warning(
      mode === "batch"
        ? "多图 AI 规划失败，已使用原提示词继续整批生成。"
        : "单图 AI 规划失败，已使用原提示词继续生成。",
    );
    return Array.from({ length: count }, () => context.prompt);
  }
}

function clearDraftIfCurrent(context: SubmissionContext): void {
  if (context.attachmentSourcesOverride === undefined) {
    context.options.setDraft("");
    context.options.clearDraftImages();
  }
}

function finishRequest(options: UsePromptSubmissionOptions, controller: AbortController): void {
  if (options.requestRef.current === controller) options.requestRef.current = null;
  options.setIsGenerating(false);
}
