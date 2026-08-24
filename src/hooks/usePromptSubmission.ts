import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { requestEditedImage, requestGeneratedImage } from "../lib/api";
import { normalizeImageQuantity } from "../lib/image-batch";
import { runImageGenerationBatch } from "../lib/image-batch-generation";
import { planStoryboard } from "../lib/conversation-api";
import { createId, titleForSubmittedPrompt } from "../lib/conversations";
import { prepareImageAttachments } from "../lib/image-attachments";
import { applyPromptSettings, parsePromptDirectives } from "../lib/prompt-directives";
import { saveSettingsPreferences } from "../lib/settings";
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
  setSettings: Dispatch<SetStateAction<GenerationSettings>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setStorageAvailable: Dispatch<SetStateAction<boolean>>;
  setLastConnectionStatus: Dispatch<SetStateAction<SettledConnectionStatus>>;
  setDraft: Dispatch<SetStateAction<string>>;
  clearDraftImages: () => void;
  openConnectionSettings: () => void;
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
        ? { cleanPrompt: originalPrompt, settingsPatch: {}, directives: [], errors: [] }
        : parsePromptDirectives(originalPrompt);
      if (directiveResult.errors.length) {
        options.toast.error(directiveResult.errors[0]!);
        return;
      }
      const prompt = directiveResult.cleanPrompt;
      const effectiveSettings = snapshotOverride
        ? options.settings
        : applyPromptSettings(options.settings, directiveResult.settingsPatch);
      if (!snapshotOverride && directiveResult.directives.length) {
        options.setSettings(effectiveSettings);
        saveSettingsPreferences(effectiveSettings);
        options.toast.info(`已根据提示词设置：${directiveResult.directives.map((item) => item.label).join(" · ")}`);
      }
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
      const quantity = normalizeImageQuantity(snapshotOverride?.quantity ?? effectiveSettings.quantity);
      const requestSnapshot: GenerationSnapshot = {
        model: IMAGE_MODEL,
        size: snapshotOverride?.size ?? effectiveSettings.size,
        quality: snapshotOverride?.quality ?? effectiveSettings.quality,
        quantity,
        mode: snapshotOverride?.mode ?? effectiveSettings.mode,
        storyboardQuantity: snapshotOverride?.storyboardQuantity ?? effectiveSettings.storyboardQuantity,
      };
      const requestSettings: GenerationRequestSettings = { ...effectiveSettings, ...requestSnapshot };

      if (requestSnapshot.mode === "storyboard") {
        await submitStoryboard({
          options, originalPrompt, prompt, conversationId, userId, now, attachmentSources,
          attachmentSourcesOverride, requestSnapshot, requestSettings, effectiveSettings,
        });
        return;
      }
      if (quantity > 1) {
        await submitBatch({
          options, originalPrompt, prompt, conversationId, userId, now, attachmentSources,
          attachmentSourcesOverride, requestSnapshot, requestSettings, quantity,
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

async function submitStoryboard(context: SubmissionContext & {
  effectiveSettings: GenerationSettings;
}): Promise<void> {
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
        context.effectiveSettings.conversation,
        context.prompt,
        context.requestSnapshot.storyboardQuantity ?? "auto",
        context.attachmentSources,
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) throw error;
      options.toast.warning("对话 AI 规划失败，已切换为基础分镜模板。 ");
      plan = await planStoryboard(
        { ...context.effectiveSettings.conversation, enabled: false },
        context.prompt,
        context.requestSnapshot.storyboardQuantity ?? "auto",
        context.attachmentSources,
        controller.signal,
      );
    }
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
    const outcome = await runImageGenerationBatch({
      prompt: context.prompt,
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
      options.toast.error(error instanceof Error ? error.message : "批量生成无法启动，请检查连接设置后重试。");
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
  const prepared = await prepareImageAttachments(context.attachmentSources, options.storageAvailable, context.now);
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
      prompt: context.prompt,
      request: context.requestSnapshot,
      status: "loading",
      createdAt: context.now + 1,
    }],
    updatedAt: context.now,
  }));
  clearDraftIfCurrent(context);
  try {
    const result = prepared.requestAttachments.length
      ? await requestEditedImage(context.requestSettings, context.prompt, prepared.requestAttachments, controller.signal)
      : await requestGeneratedImage(context.requestSettings, context.prompt, controller.signal);
    const imageDataUrl = `data:${result.mimeType};base64,${result.image}`;
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
    });
    options.setLastConnectionStatus("success");
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    options.updateAssistantMessage(context.conversationId, context.assistantId, {
      status: aborted ? "aborted" : "error",
      error: aborted ? "请求已由你停止。" : error instanceof Error ? error.message : "未知错误，请检查连接设置后重试。",
    });
    if (!aborted) options.setLastConnectionStatus("error");
  } finally {
    finishRequest(options, controller);
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
