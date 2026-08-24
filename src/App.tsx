import { useCallback, useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { App as AntdApp, Drawer, Spin } from "antd";

import AppOverlays, { type SettingsPanel } from "./components/AppOverlays";
import Composer from "./components/Composer";
import PromptOptimizationDialog from "./components/PromptOptimizationDialog";
import WindowChrome from "./components/WindowChrome";
import MessageFeed from "./components/MessageFeed";
import Sidebar from "./components/Sidebar";
import StudioHeader from "./components/StudioHeader";
import WelcomePanel from "./components/WelcomePanel";
import useConversationDeletion from "./hooks/useConversationDeletion";
import useConversationRenaming from "./hooks/useConversationRenaming";
import useImageDrafts from "./hooks/useImageDrafts";
import useDesktopUpdater from "./hooks/useDesktopUpdater";
import usePromptSubmission from "./hooks/usePromptSubmission";
import {
  createConversation,
  titleForMessages,
} from "./lib/conversations";
import { resolveMessageImageAttachments } from "./lib/image-attachments";
import { applyPromptSettings, parsePromptDirectives } from "./lib/prompt-directives";
import { optimizePrompt } from "./lib/prompt-optimizer";
import { endpointHostLabel } from "./lib/image-endpoint";
import {
  copyImageFromUrl,
  downloadImageBlob,
  downloadImageFromUrl,
  generatedImageFileName,
  type ImageActionSource,
} from "./lib/image-actions";
import {
  loadNavigationCollapsed,
  saveNavigationCollapsed,
} from "./lib/navigation-preferences";
import {
  clearStoredSettings,
  hydrateSettingsApiKey,
  loadSettings,
  saveSettings,
  saveSettingsPreferences,
} from "./lib/settings";
import { getSceneMeldRuntime, isDesktopRuntime } from "./lib/runtime";
import {
  connectionPresentation,
  countGenerations,
  createInitialWorkspace,
  missingAttachmentMessage,
} from "./lib/studio-presenters";
import {
  clearWorkspaceData,
  dataUrlToBlob,
  loadGeneratedImage,
  loadWorkspace,
  saveWorkspace,
} from "./lib/studio-db";
import { appStyles as styles } from "./styles/app.stylex";
import type {
  AssistantMessage,
  ConnectionStatus,
  Conversation,
  GenerationSettings,
  PromptOptimizationResult,
  UserMessage,
  WorkspaceSnapshot,
} from "./types";
import { IMAGE_MODEL } from "./types";

type SettledConnectionStatus = Extract<ConnectionStatus, "ready" | "success" | "error">;
export default function StudioApp() {
  const { message: toast } = AntdApp.useApp();
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [settings, setSettings] = useState<GenerationSettings>(() => loadSettings());
  const [settingsReady, setSettingsReady] = useState(() => !isDesktopRuntime());
  const [draft, setDraft] = useState("");
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(() =>
    loadNavigationCollapsed(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<PromptOptimizationResult | null>(null);
  const [optimizationSourcePrompt, setOptimizationSourcePrompt] = useState("");
  const [optimizationOpen, setOptimizationOpen] = useState(false);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [lastConnectionStatus, setLastConnectionStatus] =
    useState<SettledConnectionStatus>("ready");
  const abortRef = useRef<AbortController | null>(null);
  const optimizationAbortRef = useRef<AbortController | null>(null);
  const initializationStarted = useRef(false);
  const settingsHydrationStarted = useRef(false);
  const storageWarningShown = useRef(false);
  const desktopUpdater = useDesktopUpdater({ busy: isGenerating || Boolean(abortRef.current) });

  const openConnectionSettings = () => setSettingsPanel("connection");
  const openDataSettings = () => setSettingsPanel("data");
  const openAppearanceSettings = () => setSettingsPanel("appearance");
  const openAbout = () => setSettingsPanel("about");
  const closeSettingsPanel = () => setSettingsPanel(null);

  const configured = Boolean(settings.baseUrl && settings.apiKey);
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
  const handleRenameConversation = useConversationRenaming({ setWorkspace });
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
    if (settingsHydrationStarted.current) {
      return;
    }

    settingsHydrationStarted.current = true;
    void hydrateSettingsApiKey(settings)
      .then(setSettings)
      .catch(() => {
        toast.warning("无法读取系统凭据管理器中的 API Key，请在设置中重新填写。");
      })
      .finally(() => setSettingsReady(true));
  }, [settings, toast]);

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

  const submitPrompt = usePromptSubmission({
    workspace,
    activeConversation,
    settings,
    configured,
    isGenerating,
    requestRef: abortRef,
    draftImageSources,
    storageAvailable,
    toast,
    setSettings,
    setIsGenerating,
    setStorageAvailable,
    setLastConnectionStatus,
    setDraft,
    clearDraftImages,
    openConnectionSettings,
    updateConversation,
    updateAssistantMessage,
  });

  const handleOptimizePrompt = useCallback(async (rawPrompt: string) => {
    if (isGenerating || isOptimizingPrompt || optimizationAbortRef.current) return;
    const originalPrompt = rawPrompt.trim();
    const directiveResult = parsePromptDirectives(originalPrompt);
    if (directiveResult.errors.length) {
      toast.error(directiveResult.errors[0]);
      return;
    }
    const effectiveSettings = applyPromptSettings(settings, directiveResult.settingsPatch);
    if (directiveResult.directives.length) {
      setSettings(effectiveSettings);
      saveSettingsPreferences(effectiveSettings);
      toast.info(`已同步提示词规格：${directiveResult.directives.map((item) => item.label).join(" · ")}`);
    }
    const controller = new AbortController();
    optimizationAbortRef.current = controller;
    setIsOptimizingPrompt(true);
    try {
      const result = await optimizePrompt(
        effectiveSettings.conversation,
        directiveResult.cleanPrompt,
        controller.signal,
      );
      setOptimizationSourcePrompt(originalPrompt);
      setOptimizationResult(result);
      setOptimizationOpen(true);
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : "提示词优化失败，请检查 AI 规划连接。");
      }
    } finally {
      if (optimizationAbortRef.current === controller) optimizationAbortRef.current = null;
      setIsOptimizingPrompt(false);
    }
  }, [isGenerating, isOptimizingPrompt, settings, toast]);

  const handleSaveSettings = async (nextSettings: GenerationSettings) => {
    const normalizedSettings = { ...nextSettings, model: IMAGE_MODEL };
    const networkConnectionChanged =
      normalizedSettings.baseUrl !== settings.baseUrl ||
      normalizedSettings.apiKey !== settings.apiKey;
    const conversationConnectionChanged =
      normalizedSettings.conversation.baseUrl !== settings.conversation.baseUrl ||
      normalizedSettings.conversation.apiKey !== settings.conversation.apiKey ||
      normalizedSettings.conversation.model !== settings.conversation.model ||
      normalizedSettings.conversation.supportsStructuredOutput !== settings.conversation.supportsStructuredOutput ||
      normalizedSettings.conversation.enabled !== settings.conversation.enabled ||
      normalizedSettings.conversation.shareImageConnection !== settings.conversation.shareImageConnection;
    const credentialStorageChanged = normalizedSettings.rememberApiKey !== settings.rememberApiKey;
    const connectionSettingsChanged =
      networkConnectionChanged ||
      conversationConnectionChanged ||
      credentialStorageChanged;

    try {
      await saveSettings(normalizedSettings);
      setSettings(normalizedSettings);
      closeSettingsPanel();
      if (networkConnectionChanged) {
        setLastConnectionStatus("ready");
      }
      const desktop = isDesktopRuntime();
      toast.success(
        connectionSettingsChanged
          ? credentialStorageChanged
            ? normalizedSettings.rememberApiKey
              ? desktop
                ? "连接设置已保存，应用已请求系统凭据管理器保存已配置的连接凭据。"
                : "连接设置已保存，已配置的连接凭据将保留在此浏览器中。"
              : desktop
                ? "连接设置已保存，连接凭据仅保留到本次应用会话结束。"
                : "连接设置已保存，连接凭据仅保留到页面刷新前。"
            : "连接设置已保存。"
          : "工作区设置已保存。",
      );
    } catch {
      toast.error(
        isDesktopRuntime()
          ? "无法写入系统凭据管理器，设置未保存。"
          : "无法保存连接设置，请检查浏览器存储权限。",
      );
    }
  };

  const handleQuickSettingChange = (patch: Partial<GenerationSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch, model: IMAGE_MODEL };
      saveSettingsPreferences(next);
      return next;
    });
  };

  const handleNavigationCollapsedChange = (collapsed: boolean) => {
    setNavigationCollapsed(collapsed);
    saveNavigationCollapsed(collapsed);
  };

  const handleResetSettings = async () => {
    try {
      const reset = await clearStoredSettings();
      setSettings(reset);
      setLastConnectionStatus("ready");
      toast.success("连接配置已清除。");
    } catch {
      toast.error("无法清除系统凭据管理器中的 API Key，请稍后重试。");
    }
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

  const handleCopyImage = async (source: ImageActionSource) => {
    try {
      await copyImageFromUrl(source);
      toast.success("图片已复制。");
    } catch {
      toast.error("图片复制失败，请使用下载图片。");
    }
  };

  const handleDownloadImage = async (source: ImageActionSource) => {
    try {
      const result = await downloadImageFromUrl(source);
      if (result === "saved") {
        toast.success("图片已保存。");
      }
    } catch {
      toast.error("无法读取本地图片，请重新生成或重试。");
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

      const result = await downloadImageBlob(
        blob,
        generatedImageFileName(item.createdAt, item.mimeType),
        item.mimeType,
      );
      if (result === "saved") {
        toast.success("图片已保存。");
      }
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
        { ...item.request, quantity: 1 },
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

      const updatedConversation: Conversation = {
        ...target,
        title: titleForMessages(target, messages),
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

  const handleSelectConversation = (activeId: string) => {
    setWorkspace((current) => (current ? { ...current, activeId } : current));
    setDraft("");
    clearDraftImages();
    setNavigationOpen(false);
  };

  if (!workspaceReady || !settingsReady || !workspace || !activeConversation) {
    return (
      <div {...stylex.props(styles.loadingShell)}>
        <WindowChrome />
        <Spin size="large" />
        <span>正在读取本地创作记录...</span>
      </div>
    );
  }

  const connection = connectionPresentation(connectionStatus, getSceneMeldRuntime());
  const createDisabledReason = isGenerating
    ? "请先等待当前图片生成完成，或停止生成。"
    : activeConversation.messages.length === 0
      ? "请先开始当前创作。"
      : undefined;
  const sharedSidebarProps = {
    onCreate: handleCreateConversation,
    onDelete: handleDeleteConversation,
    onRename: handleRenameConversation,
    onOpenData: openDataSettings,
    onOpenAppearance: openAppearanceSettings,
    onOpenAbout: openAbout,
  };

  return (
    <div {...stylex.props(styles.app, isDesktopRuntime() && styles.desktopApp)}>
      <WindowChrome
        updateSnapshot={desktopUpdater.snapshot}
        onOpenUpdates={openAbout}
        onCheckForUpdates={desktopUpdater.checkForUpdates}
      />
      <Sidebar
        conversations={workspace.conversations}
        activeId={workspace.activeId}
        collapsed={navigationCollapsed}
        disabled={Boolean(createDisabledReason)}
        disabledReason={createDisabledReason}
        deletionDisabled={isGenerating}
        deletionDisabledReason="请先等待当前图片生成完成，或停止生成。"
        {...sharedSidebarProps}
        onCollapsedChange={handleNavigationCollapsedChange}
        onSelect={handleSelectConversation}
      />

      <main id="main-content" tabIndex={-1} {...stylex.props(styles.main)}>
        <div {...stylex.props(styles.mainHeader)}>
          <StudioHeader
            conversation={activeConversation}
            generationCount={countGenerations(activeConversation)}
            connection={connection}
            endpointLabel={endpointHostLabel(settings.baseUrl)}
            model={IMAGE_MODEL}
            onOpenNavigation={() => setNavigationOpen(true)}
            onOpenSettings={openConnectionSettings}
          />
        </div>

        <section
          {...stylex.props(
            styles.conversationPane,
            activeConversation.messages.length === 0 && styles.conversationPaneEmpty,
          )}
          aria-label="图片生成对话"
        >
          {activeConversation.messages.length === 0 ? (
            <WelcomePanel
              configured={configured}
              onChoosePrompt={setDraft}
              onOpenSettings={openConnectionSettings}
            />
          ) : (
            <MessageFeed
              conversationId={activeConversation.id}
              messages={activeConversation.messages}
              onCopy={handleCopy}
              onCopyImage={handleCopyImage}
              onDownload={handleDownload}
              onDownloadImage={handleDownloadImage}
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
          optimizing={isOptimizingPrompt}
          onChange={setDraft}
          onAddFiles={handleAddDraftImages}
          onRemoveFile={removeDraftImage}
          onSubmit={(value) => void submitPrompt(value)}
          onOptimize={(value) => void handleOptimizePrompt(value)}
          onCancel={() => abortRef.current?.abort()}
          onQuickSettingChange={handleQuickSettingChange}
        />
      </main>

      <AppOverlays
        settingsPanel={settingsPanel}
        settings={settings}
        conversationCount={workspace.conversations.length}
        generationCount={totalGenerations}
        storageAvailable={storageAvailable}
        historyClearing={historyClearing}
        desktopUpdateSnapshot={desktopUpdater.snapshot}
        updateBusy={isGenerating || Boolean(abortRef.current)}
        onCloseSettings={closeSettingsPanel}
        onSaveSettings={handleSaveSettings}
        onResetSettings={handleResetSettings}
        onClearHistory={handleClearHistory}
        onCheckForUpdates={desktopUpdater.checkForUpdates}
        onInstallUpdate={desktopUpdater.installUpdate}
      />

      <PromptOptimizationDialog
        open={optimizationOpen}
        originalPrompt={optimizationSourcePrompt}
        result={optimizationResult}
        onClose={() => setOptimizationOpen(false)}
        onApply={(value) => {
          setDraft(value);
          setOptimizationOpen(false);
        }}
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
          {...sharedSidebarProps}
          onSelect={handleSelectConversation}
        />
      </Drawer>
    </div>
  );
}
