import { useCallback, useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { App as AntdApp, Drawer, Spin } from "antd";

import Composer from "./components/Composer";
import MessageFeed from "./components/MessageFeed";
import SettingsDrawer from "./components/SettingsDrawer";
import Sidebar from "./components/Sidebar";
import StudioHeader from "./components/StudioHeader";
import WelcomePanel from "./components/WelcomePanel";
import useConversationDeletion from "./hooks/useConversationDeletion";
import useImageDrafts from "./hooks/useImageDrafts";
import { requestEditedImage, requestGeneratedImage } from "./lib/api";
import {
  createConversation,
  createId,
  promptToTitle,
} from "./lib/conversations";
import {
  prepareImageAttachments,
  resolveMessageImageAttachments,
} from "./lib/image-attachments";
import { endpointHostLabel } from "./lib/image-endpoint";
import {
  loadNavigationCollapsed,
  saveNavigationCollapsed,
} from "./lib/navigation-preferences";
import { clearStoredSettings, loadSettings, saveSettings } from "./lib/settings";
import {
  base64ToBlob,
  clearWorkspaceData,
  dataUrlToBlob,
  loadGeneratedImage,
  loadWorkspace,
  saveGeneratedImage,
  saveWorkspace,
} from "./lib/studio-db";
import { colors } from "./styles/tokens.stylex";
import type {
  AssistantMessage,
  ConnectionStatus,
  Conversation,
  GenerationRequestSettings,
  GenerationSettings,
  GenerationSnapshot,
  ImageAttachmentSource,
  UserMessage,
  WorkspaceSnapshot,
} from "./types";

type SettledConnectionStatus = Extract<ConnectionStatus, "ready" | "success" | "error">;

export default function StudioApp() {
  const { message: toast } = AntdApp.useApp();
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [settings, setSettings] = useState<GenerationSettings>(() => loadSettings());
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(() =>
    loadNavigationCollapsed(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [lastConnectionStatus, setLastConnectionStatus] =
    useState<SettledConnectionStatus>("ready");
  const abortRef = useRef<AbortController | null>(null);
  const initializationStarted = useRef(false);
  const storageWarningShown = useRef(false);

  const configured = Boolean(settings.baseUrl && settings.apiKey && settings.model);
  const connectionStatus: ConnectionStatus = !configured
    ? "incomplete"
    : isGenerating
      ? "requesting"
      : lastConnectionStatus;
  const activeConversation = workspace
    ? (workspace.conversations.find((item) => item.id === workspace.activeId) ??
      workspace.conversations[0])
    : null;
  const {
    attachments: draftImages,
    sources: draftImageSources,
    addFiles: addDraftImages,
    remove: removeDraftImage,
    clear: clearDraftImages,
    restoreMessageAttachments,
    restoreAssistantImage,
  } = useImageDrafts(activeConversation?.id ?? null);
  const handleDeleteConversation = useConversationDeletion({
    workspace, requestBusy: isGenerating || Boolean(abortRef.current), setWorkspace, setDraft,
    clearDraftImages, closeNavigation: () => setNavigationOpen(false), toast,
  });
  const totalGenerations =
    workspace?.conversations.reduce(
      (total, conversation) => total + countGenerations(conversation),
      0,
    ) ?? 0;

  useEffect(() => {
    if (initializationStarted.current) {
      return;
    }

    initializationStarted.current = true;
    void (async () => {
      try {
        const storedWorkspace = await loadWorkspace();
        setWorkspace(storedWorkspace ?? createInitialWorkspace());
      } catch {
        setStorageAvailable(false);
        setWorkspace(createInitialWorkspace());
        toast.warning("无法读取本地创作记录，本次页面将使用临时会话。");
      } finally {
        setWorkspaceReady(true);
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (!workspaceReady || !workspace || !storageAvailable) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveWorkspace(workspace).catch(() => {
        setStorageAvailable(false);
        if (!storageWarningShown.current) {
          storageWarningShown.current = true;
          toast.warning("本地创作记录保存失败，新内容将仅保留在当前页面中。");
        }
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [storageAvailable, toast, workspace, workspaceReady]);

  const updateConversation = useCallback(
    (conversationId: string, update: (conversation: Conversation) => Conversation) => {
      setWorkspace((current) =>
        current
          ? {
              ...current,
              conversations: current.conversations.map((conversation) =>
                conversation.id === conversationId ? update(conversation) : conversation,
              ),
            }
          : current,
      );
    },
    [],
  );

  const updateAssistantMessage = useCallback(
    (conversationId: string, assistantId: string, patch: Partial<AssistantMessage>) => {
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((item) =>
          item.type === "assistant" && item.id === assistantId ? { ...item, ...patch } : item,
        ),
        updatedAt: Date.now(),
      }));
    },
    [updateConversation],
  );

  const submitPrompt = useCallback(
    async (
      rawPrompt: string,
      snapshotOverride?: GenerationSnapshot,
      conversationIdOverride?: string,
      attachmentSourcesOverride?: ImageAttachmentSource[],
    ) => {
      const prompt = rawPrompt.trim();
      const targetConversation = conversationIdOverride
        ? workspace?.conversations.find(
            (conversation) => conversation.id === conversationIdOverride,
          )
        : activeConversation;

      if (
        !prompt ||
        isGenerating ||
        abortRef.current ||
        !targetConversation
      ) {
        return;
      }

      if (prompt.length > 20_000) {
        toast.error("提示词不能超过 20,000 个字符。");
        return;
      }

      if (!configured) {
        setSettingsOpen(true);
        toast.warning("请先填写 API 基础地址、API Key 与模型。");
        return;
      }

      const conversationId = targetConversation.id;
      const userId = createId("user");
      const assistantId = createId("assistant");
      const now = Date.now();
      const attachmentSources = attachmentSourcesOverride ?? draftImageSources;
      const requestSnapshot: GenerationSnapshot = snapshotOverride ?? {
        model: settings.model,
        size: settings.size,
        quality: settings.quality,
      };
      const requestSettings: GenerationRequestSettings = {
        ...settings,
        ...requestSnapshot,
      };
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      const preparedAttachments = await prepareImageAttachments(
        attachmentSources,
        storageAvailable,
        now,
      );
      if (preparedAttachments.persistenceFailed) {
        setStorageAvailable(false);
        toast.warning(
          "参考图仍可用于本次请求，但无法保存到本地；刷新页面后可能无法再次编辑。",
        );
      }

      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        title:
          conversation.messages.length === 0 ? promptToTitle(prompt) : conversation.title,
        messages: [
          ...conversation.messages,
          {
            id: userId,
            type: "user",
            prompt,
            createdAt: now,
            ...(preparedAttachments.messageAttachments.length > 0
              ? { attachments: preparedAttachments.messageAttachments }
              : {}),
          },
          {
            id: assistantId,
            type: "assistant",
            prompt,
            request: requestSnapshot,
            status: "loading",
            createdAt: now + 1,
          },
        ],
        updatedAt: now,
      }));
      if (attachmentSourcesOverride === undefined) {
        setDraft("");
        clearDraftImages();
      }

      try {
        const result = preparedAttachments.requestAttachments.length
          ? await requestEditedImage(
              requestSettings,
              prompt,
              preparedAttachments.requestAttachments,
              controller.signal,
            )
          : await requestGeneratedImage(requestSettings, prompt, controller.signal);
        const imageDataUrl = `data:${result.mimeType};base64,${result.image}`;
        let imageStored = false;

        if (storageAvailable) {
          try {
            const blob = base64ToBlob(result.image, result.mimeType);
            await saveGeneratedImage(assistantId, blob, result.mimeType, now + 1);
            imageStored = true;
          } catch {
            setStorageAvailable(false);
            toast.warning("图片已生成，但无法保存到本地。请在关闭页面前下载图片。");
          }
        }

        updateAssistantMessage(conversationId, assistantId, {
          status: "success",
          ...(imageStored ? { imageId: assistantId } : { imageDataUrl }),
          mimeType: result.mimeType,
          revisedPrompt: result.revisedPrompt,
          source: result.source,
        });
        setLastConnectionStatus("success");
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        updateAssistantMessage(conversationId, assistantId, {
          status: aborted ? "aborted" : "error",
          error: aborted
            ? "请求已由你停止。"
            : error instanceof Error
              ? error.message
              : "未知错误，请检查连接设置后重试。",
        });
        if (!aborted) {
          setLastConnectionStatus("error");
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsGenerating(false);
      }
    },
    [
      activeConversation,
      clearDraftImages,
      configured,
      draftImageSources,
      isGenerating,
      settings,
      storageAvailable,
      toast,
      updateAssistantMessage,
      updateConversation,
      workspace,
    ],
  );

  const handleSaveSettings = (nextSettings: GenerationSettings) => {
    const connectionChanged =
      nextSettings.baseUrl !== settings.baseUrl ||
      nextSettings.apiKey !== settings.apiKey ||
      nextSettings.model !== settings.model;

    setSettings(nextSettings);
    saveSettings(nextSettings);
    setSettingsOpen(false);
    if (connectionChanged) {
      setLastConnectionStatus("ready");
    }
    toast.success(
      nextSettings.rememberApiKey
        ? "设置已保存，API Key 将保留在此浏览器中。"
        : "设置已保存，API Key 仅保留到页面刷新前。",
    );
  };

  const handleQuickSettingChange = (patch: Partial<GenerationSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const handleNavigationCollapsedChange = (collapsed: boolean) => {
    setNavigationCollapsed(collapsed);
    saveNavigationCollapsed(collapsed);
  };

  const handleResetSettings = () => {
    const reset = clearStoredSettings();
    setSettings(reset);
    setLastConnectionStatus("ready");
    toast.success("连接配置已清除。");
  };

  const handleClearHistory = async () => {
    if (isGenerating || abortRef.current) {
      toast.warning("请先等待当前图片生成完成，或停止生成。");
      return;
    }

    setHistoryClearing(true);
    try {
      await clearWorkspaceData();
      setWorkspace(createInitialWorkspace());
      setDraft("");
      clearDraftImages();
      setStorageAvailable(true);
      storageWarningShown.current = false;
      toast.success("本地创作记录已清除。");
    } catch {
      toast.error("无法清除本地创作记录，请稍后重试。");
    } finally {
      setHistoryClearing(false);
    }
  };

  const handleCreateConversation = () => {
    if (!workspace) {
      return;
    }

    if (isGenerating || abortRef.current) {
      toast.warning("请先等待当前图片生成完成，或停止生成。");
      return;
    }

    const emptyConversation = workspace.conversations.find(
      (conversation) => conversation.messages.length === 0,
    );
    if (emptyConversation) {
      setDraft("");
      clearDraftImages();
      setWorkspace((current) =>
        current ? { ...current, activeId: emptyConversation.id } : current,
      );
      setNavigationOpen(false);
      toast.info(
        emptyConversation.id === workspace.activeId
          ? "请先开始当前创作。"
          : "已有一个空白创作，已为你打开。",
      );
      return;
    }

    const conversation = createConversation();
    setWorkspace((current) =>
      current
        ? {
            conversations: [conversation, ...current.conversations],
            activeId: conversation.id,
          }
        : current,
    );
    setDraft("");
    clearDraftImages();
    setNavigationOpen(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("提示词已复制。");
    } catch {
      toast.error("复制失败，请手动选择提示词。");
    }
  };

  const handleDownload = async (item: AssistantMessage) => {
    try {
      const blob = item.imageDataUrl
        ? await dataUrlToBlob(item.imageDataUrl)
        : item.imageId
          ? await loadGeneratedImage(item.imageId)
          : null;

      if (!blob) {
        throw new Error("missing image");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gpt-image-${new Date(item.createdAt).toISOString().replace(/[:.]/g, "-")}.${mimeExtension(item.mimeType)}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      toast.error("无法读取本地图片，请重新生成或使用预览中的保存功能。");
    }
  };

  const handleRegenerate = (item: AssistantMessage, source?: UserMessage) => {
    void (async () => {
      const resolved = await resolveMessageImageAttachments(source?.attachments);
      if (!resolved.ok) {
        toast.error(missingAttachmentMessage(resolved.missing));
        return;
      }

      await submitPrompt(
        item.prompt,
        item.request,
        activeConversation?.id,
        resolved.sources,
      );
    })();
  };

  const handleEditPrompt = (message: UserMessage) => {
    void (async () => {
      if (message.attachments?.length) {
        const restored = await restoreMessageAttachments(message.attachments);
        if (restored.cancelled) {
          return;
        }
        if (!restored.ok) {
          toast.error(missingAttachmentMessage(restored.missing ?? []));
          return;
        }
      } else {
        clearDraftImages();
      }

      setDraft(message.prompt);
      toast.info("提示词与参考图已放回输入框，可以继续修改。");
    })();
  };

  const handleContinueEditing = (item: AssistantMessage) => {
    void (async () => {
      const restored = await restoreAssistantImage(item);
      if (restored.cancelled) {
        return;
      }
      if (!restored.ok) {
        toast.error("生成图片的本地文件已不可用，请先重新生成后再继续修改。");
        return;
      }

      setDraft(item.revisedPrompt?.trim() || item.prompt);
      toast.info("生成结果已作为参考图放入输入框，可以继续描述修改要求。");
    })();
  };

  const handleDeleteTurn = (conversationId: string, messageIds: string[]) => {
    if (isGenerating || abortRef.current) {
      toast.warning("生成期间不能删除对话记录。");
      return;
    }

    const removedIds = new Set(messageIds);
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      const target = current.conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      if (!target) {
        return current;
      }

      const messages = target.messages.filter((message) => !removedIds.has(message.id));
      if (messages.length === target.messages.length) {
        return current;
      }

      if (messages.length === 0) {
        const existingEmpty = current.conversations.find(
          (conversation) =>
            conversation.id !== conversationId && conversation.messages.length === 0,
        );
        if (existingEmpty) {
          return {
            conversations: current.conversations.filter(
              (conversation) => conversation.id !== conversationId,
            ),
            activeId:
              current.activeId === conversationId ? existingEmpty.id : current.activeId,
          };
        }
      }

      const firstPrompt = messages.find((message) => message.type === "user")?.prompt;
      const updatedConversation: Conversation = {
        ...target,
        title: firstPrompt ? promptToTitle(firstPrompt) : "新创作",
        messages,
        updatedAt: Date.now(),
      };

      return {
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === conversationId ? updatedConversation : conversation,
        ),
      };
    });
    toast.success("这轮对话和本地图片已删除。");
  };

  const handleAddDraftImages = (files: File[] | FileList) => {
    if (isGenerating) {
      return;
    }

    for (const error of addDraftImages(files)) {
      toast.error(error);
    }
  };

  if (!workspaceReady || !workspace || !activeConversation) {
    return (
      <div {...stylex.props(styles.loadingShell)}>
        <Spin size="large" />
        <span>正在读取本地创作记录...</span>
      </div>
    );
  }

  const connection = connectionPresentation(connectionStatus);
  const createDisabledReason = isGenerating
    ? "请先等待当前图片生成完成，或停止生成。"
    : activeConversation.messages.length === 0
      ? "请先开始当前创作。"
      : undefined;

  return (
    <div {...stylex.props(styles.app)}>
      <Sidebar
        conversations={workspace.conversations}
        activeId={workspace.activeId}
        collapsed={navigationCollapsed}
        disabled={Boolean(createDisabledReason)}
        disabledReason={createDisabledReason}
        deletionDisabled={isGenerating}
        deletionDisabledReason="请先等待当前图片生成完成，或停止生成。"
        onCollapsedChange={handleNavigationCollapsedChange}
        onSelect={(activeId) => {
          setWorkspace((current) => (current ? { ...current, activeId } : current));
          setDraft("");
          clearDraftImages();
          setNavigationOpen(false);
        }}
        onCreate={handleCreateConversation}
        onDelete={handleDeleteConversation}
      />

      <main id="main-content" tabIndex={-1} {...stylex.props(styles.main)}>
        <StudioHeader
          conversation={activeConversation}
          generationCount={countGenerations(activeConversation)}
          connection={connection}
          endpointLabel={endpointHostLabel(settings.baseUrl)}
          model={settings.model}
          onOpenNavigation={() => setNavigationOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <section {...stylex.props(styles.conversationPane)} aria-label="图片生成对话">
          {activeConversation.messages.length === 0 ? (
            <WelcomePanel
              configured={configured}
              onChoosePrompt={setDraft}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <MessageFeed
              conversationId={activeConversation.id}
              messages={activeConversation.messages}
              onCopy={handleCopy}
              onDownload={handleDownload}
              onRegenerate={handleRegenerate}
              onEditPrompt={handleEditPrompt}
              onContinueEditing={handleContinueEditing}
              onDelete={(messageIds) =>
                handleDeleteTurn(activeConversation.id, messageIds)
              }
              busy={isGenerating}
            />
          )}
        </section>

        <Composer
          value={draft}
          attachments={draftImages}
          settings={settings}
          loading={isGenerating}
          onChange={setDraft}
          onAddFiles={handleAddDraftImages}
          onRemoveFile={removeDraftImage}
          onSubmit={(value) => void submitPrompt(value)}
          onCancel={() => abortRef.current?.abort()}
          onQuickSettingChange={handleQuickSettingChange}
        />
      </main>

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        conversationCount={workspace.conversations.length}
        generationCount={totalGenerations}
        storageAvailable={storageAvailable}
        historyClearing={historyClearing}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
        onClearHistory={() => void handleClearHistory()}
      />

      <Drawer
        placement="left"
        width={284}
        title={null}
        open={navigationOpen}
        rootClassName="studio-glass-drawer"
        onClose={() => setNavigationOpen(false)}
        styles={{ body: { padding: 0, background: "transparent" } }}
      >
        <Sidebar
          embedded
          conversations={workspace.conversations}
          activeId={workspace.activeId}
          disabled={Boolean(createDisabledReason)}
          disabledReason={createDisabledReason}
          deletionDisabled={isGenerating}
          deletionDisabledReason="请先等待当前图片生成完成，或停止生成。"
          onSelect={(activeId) => {
            setWorkspace((current) => (current ? { ...current, activeId } : current));
            setDraft("");
            clearDraftImages();
            setNavigationOpen(false);
          }}
          onCreate={handleCreateConversation}
          onDelete={handleDeleteConversation}
        />
      </Drawer>
    </div>
  );
}

function createInitialWorkspace(): WorkspaceSnapshot {
  const conversation = createConversation();
  return { conversations: [conversation], activeId: conversation.id };
}

function connectionPresentation(status: ConnectionStatus): {
  label: string;
  description: string;
  color?: string;
} {
  return {
    incomplete: { label: "未配置", description: "连接信息尚未填写完整。" },
    ready: {
      label: "配置完整",
      description: "浏览器将在下一次生成时直接验证目标 API。",
      color: "blue",
    },
    requesting: {
      label: "请求中",
      description: "浏览器正在直接向目标 API 请求图片。",
      color: "processing",
    },
    success: { label: "最近成功", description: "最近一次图片生成请求成功。", color: "green" },
    error: { label: "最近失败", description: "最近一次图片生成请求失败。", color: "red" },
  }[status];
}

function countGenerations(conversation: Conversation): number {
  return conversation.messages.filter((item) => item.type === "assistant").length;
}

function mimeExtension(mimeType?: string): string {
  return {
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  }[mimeType || ""] ?? "png";
}

function missingAttachmentMessage(names: string[]): string {
  const label =
    names.length > 2
      ? `${names.slice(0, 2).join("、")}等 ${names.length} 张图片`
      : names.join("、");
  return `参考图${label ? `“${label}”` : ""}的本地文件已不可用，无法复用这次图生图请求。`;
}

const styles = stylex.create({
  loadingShell: {
    minWidth: "320px",
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "14px",
    color: colors.muted,
    backgroundColor: colors.canvas,
  },
  app: {
    minWidth: "320px",
    minHeight: "100dvh",
    display: "flex",
    color: colors.ink,
    background: colors.canvasAmbient,
  },
  main: {
    minWidth: 0,
    height: "100dvh",
    flex: 1,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    gap: "10px",
    padding: "12px",
    overflow: "hidden",
    outline: "none",
  },
  conversationPane: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarGutter: "stable",
  },
});
