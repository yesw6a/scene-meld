import { useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Form,
  App as AntdApp,
  Tag,
  Typography,
} from "antd";
import {
  Database,
  KeyRound,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import {
  buildImageApiEndpoint,
  endpointHostLabel,
  normalizeImageApiBaseUrl,
} from "../lib/image-endpoint";
import { isDesktopRuntime } from "../lib/runtime";
import { listConversationModels } from "../lib/conversation-models";
import ConnectionSettingsSection from "./ConnectionSettingsSection";
import NetworkProxySection from "./NetworkProxySection";
import { useProxySettings } from "../hooks/useProxySettings";
import { DEFAULT_CONVERSATION_MODEL, IMAGE_MODEL, type ConversationSettings, type GenerationSettings } from "../types";
import { colors, motion, radii } from "../styles/tokens.stylex";

type ConversationCredentialDraft = Pick<
  ConversationSettings,
  "baseUrl" | "apiKey" | "rememberApiKey"
>;

interface SettingsDrawerProps {
  open: boolean;
  section: "connection" | "workspace" | "data";
  settings: GenerationSettings;
  conversationCount: number;
  generationCount: number;
  storageAvailable: boolean;
  historyClearing: boolean;
  onClose: () => void;
  onSave: (settings: GenerationSettings) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onClearHistory: () => void | Promise<void>;
}

export default function SettingsDrawer({
  open,
  section,
  settings,
  conversationCount,
  generationCount,
  storageAvailable,
  historyClearing,
  onClose,
  onSave,
  onReset,
  onClearHistory,
}: SettingsDrawerProps) {
  const { modal, message } = AntdApp.useApp();
  const [draft, setDraft] = useState(settings);
  const [endpointError, setEndpointError] = useState<string>();
  const [conversationEndpointError, setConversationEndpointError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string>();
  const independentConversationDraft = useRef<ConversationCredentialDraft | null>(null);
  const desktop = isDesktopRuntime();
  const proxy = useProxySettings(open && section === "connection" && desktop);
  const dataOnly = section === "data";
  const requestEndpoint = previewGenerationEndpoint(draft.baseUrl);
  const requestHost = endpointHostLabel(draft.baseUrl, "");
  const connectionDirty = !dataOnly && JSON.stringify(draft) !== JSON.stringify(settings);
  const hasUnsavedChanges = connectionDirty || proxy.dirty;

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setEndpointError(undefined);
      setConversationEndpointError(undefined);
      setFormError(undefined);
      setModelOptions([]);
      setModelError(undefined);
      independentConversationDraft.current = settings.conversation.shareImageConnection
        ? null
        : pickConversationCredentials(settings.conversation);
    }
  }, [open, section, settings]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setModelOptions([]);
    setModelError(undefined);
  }, [
    draft.baseUrl,
    draft.apiKey,
    draft.conversation.baseUrl,
    draft.conversation.apiKey,
    draft.conversation.planningScopes.single,
    draft.conversation.planningScopes.batch,
    draft.conversation.planningScopes.storyboard,
    draft.conversation.shareImageConnection,
    open,
  ]);

  useEffect(() => {
    if (!open || draft.conversation.shareImageConnection) {
      return;
    }

    independentConversationDraft.current = pickConversationCredentials(draft.conversation);
  }, [
    draft.conversation.apiKey,
    draft.conversation.baseUrl,
    draft.conversation.rememberApiKey,
    draft.conversation.shareImageConnection,
    open,
  ]);

  const updateDraft = <Key extends keyof GenerationSettings>(
    key: Key,
    value: GenerationSettings[Key],
  ) => {
    setDraft((current) => key === "rememberApiKey"
      ? {
          ...current,
          rememberApiKey: value as boolean,
          conversation: { ...current.conversation, rememberApiKey: value as boolean },
        }
      : { ...current, [key]: value });
  };

  const updateConversation = <Key extends keyof ConversationSettings>(
    key: Key,
    value: ConversationSettings[Key],
  ) => {
    setDraft((current) => ({
      ...current,
      conversation: { ...current.conversation, [key]: value },
    }));
  };

  const handleConnectionModeChange = (shared: boolean) => {
    setDraft((current) => {
      if (current.conversation.shareImageConnection === shared) {
        return current;
      }

      if (shared) {
        independentConversationDraft.current = pickConversationCredentials(current.conversation);
        return {
          ...current,
          conversation: { ...current.conversation, shareImageConnection: true },
        };
      }

      const restored = independentConversationDraft.current;
      return {
        ...current,
        conversation: {
          ...current.conversation,
          ...(restored ?? {}),
          shareImageConnection: false,
        },
      };
    });
    setEndpointError(undefined);
    setConversationEndpointError(undefined);
    setFormError(undefined);
  };

  const handleDiscoverModels = async () => {
    const conversation = draft.conversation.shareImageConnection
      ? { baseUrl: draft.baseUrl, apiKey: draft.apiKey }
      : { baseUrl: draft.conversation.baseUrl, apiKey: draft.conversation.apiKey };
    setModelLoading(true);
    setModelError(undefined);
    try {
      const options = await listConversationModels(conversation);
      setModelOptions(options);
    } catch (error) {
      setModelOptions([]);
      setModelError(error instanceof Error ? error.message : "无法获取模型列表，请手动填写。");
    } finally {
      setModelLoading(false);
    }
  };

  const handleSave = async () => {
    if (dataOnly) {
      return;
    }

    if (section === "connection" && proxy.dirty && !connectionDirty) {
      setSaving(true);
      setFormError(undefined);
      try {
        await proxy.save();
        void message.success("代理设置已保存，对新操作生效。");
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "代理设置保存失败。");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (section === "workspace") {
      setFormError(undefined);
      setConversationEndpointError(undefined);
      setSaving(true);
      try {
        await onSave(draft);
      } finally {
        setSaving(false);
      }
      return;
    }

    let normalizedBaseUrl: string;

    try {
      normalizedBaseUrl = normalizeImageApiBaseUrl(draft.baseUrl);
    } catch (error) {
      setEndpointError(error instanceof Error ? error.message : "请输入有效的 HTTPS 地址。");
      setConversationEndpointError(undefined);
      setFormError(undefined);
      return;
    }

    let conversationBaseUrl = draft.conversation.baseUrl.trim();
    const shouldValidateConversation =
      !draft.conversation.shareImageConnection &&
      (
        hasEnabledConversationPlanning(draft.conversation) ||
        Boolean(conversationBaseUrl || draft.conversation.apiKey.trim())
      );
    if (shouldValidateConversation) {
      try {
        conversationBaseUrl = normalizeImageApiBaseUrl(conversationBaseUrl);
      } catch (error) {
        setEndpointError(undefined);
        setConversationEndpointError(error instanceof Error ? error.message : "请输入有效的对话 AI Endpoint。 ");
        setFormError(undefined);
        return;
      }
      if (!draft.conversation.apiKey.trim()) {
        setEndpointError(undefined);
        setConversationEndpointError(undefined);
        setFormError("请填写对话 AI API Key。 ");
        return;
      }
    }

    const trimmed = {
      ...draft,
      baseUrl: normalizedBaseUrl,
      apiKey: draft.apiKey.trim(),
      model: draft.model,
      conversation: {
        ...draft.conversation,
        baseUrl: conversationBaseUrl,
        apiKey: draft.conversation.apiKey.trim(),
        model: draft.conversation.model.trim() || DEFAULT_CONVERSATION_MODEL,
        rememberApiKey: draft.rememberApiKey,
      },
    };

    if (!trimmed.apiKey) {
      setEndpointError(undefined);
      setConversationEndpointError(undefined);
      setFormError("请填写 API Key。");
      return;
    }

    setEndpointError(undefined);
    setConversationEndpointError(undefined);
    setFormError(undefined);
    setSaving(true);
    try {
      if (proxy.dirty) await proxy.save();
      await onSave(trimmed);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "设置保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await onReset();
    setEndpointError(undefined);
    setConversationEndpointError(undefined);
    setFormError(undefined);
    independentConversationDraft.current = null;
  };

  const confirmClearHistory = () => {
    modal.confirm({
      title: "清除全部本地创作记录？",
      content: "会话、消息和已保存图片都会删除；应用内无法撤销。连接配置不受影响。",
      okText: "清除记录",
      cancelText: "取消",
      okType: "danger",
      centered: true,
      mask: { closable: false },
      onOk: onClearHistory,
    });
  };

  const confirmReset = () => {
    modal.confirm({
      title: "清除连接配置？",
      content: "创作记录会保留，但下次生成前需要重新填写连接信息。",
      okText: "清除配置",
      cancelText: "取消",
      centered: true,
      mask: { closable: false },
      okButtonProps: {
        className: stylex.props(styles.warningConfirmButton).className,
      },
      onOk: handleReset,
    });
  };

  return (
    <Drawer
      title={
        <span {...stylex.props(styles.drawerTitle)}>
          {section === "connection" ? (
            <KeyRound aria-hidden="true" size={19} strokeWidth={1.8} />
          ) : section === "data" ? (
            <Database aria-hidden="true" size={19} strokeWidth={1.8} />
          ) : (
            <SlidersHorizontal aria-hidden="true" size={19} strokeWidth={1.8} />
          )}
          {section === "connection"
             ? "连接配置"
            : section === "data"
              ? "本地数据"
              : "工作区设置"}
        </span>
      }
      width={section === "connection" ? "min(800px, 100vw)" : "min(420px, 100vw)"}
      open={open}
      rootClassName={`studio-glass-drawer${section === "connection" ? " studio-connection-drawer" : ""}`}
      onClose={() => { if (!saving) onClose(); }}
      footer={
        <div {...stylex.props(styles.footer)}>
          {!dataOnly ? (
            <span aria-live="polite" {...stylex.props(styles.saveStatus, hasUnsavedChanges && styles.saveStatusDirty)}>
              {proxy.loading ? "正在读取设置…" : proxy.error ? "代理设置需要处理" : hasUnsavedChanges ? "有未保存的更改" : "设置已保存"}
            </span>
          ) : null}
          <Button className={stylex.props(styles.footerButton).className} disabled={saving} onClick={onClose}>
            {dataOnly ? "关闭" : "取消"}
          </Button>
          {!dataOnly ? (
            <Button
              type="primary"
              icon={<Save size={16} />}
              loading={saving}
              disabled={!hasUnsavedChanges || proxy.loading}
              className={stylex.props(styles.footerButton).className}
              onClick={() => void handleSave()}
            >
              保存设置
            </Button>
          ) : null}

        </div>
      }
    >
      <div {...stylex.props(styles.content)}>
        <Form layout="vertical" requiredMark="optional" disabled={saving}>
          {formError ? <Alert type="error" showIcon message={formError} /> : null}

          {section === "connection" ? (
            <ConnectionSettingsSection
              key={open ? "open" : "closed"}
              draft={draft}
              desktop={desktop}
              endpointError={endpointError}
              conversationEndpointError={conversationEndpointError}
              requestEndpoint={requestEndpoint}
              requestHost={requestHost}
              onUpdate={updateDraft}
              onUpdateConversation={updateConversation}
              onConnectionModeChange={handleConnectionModeChange}
              hasUnsavedChanges={connectionDirty}
              modelOptions={modelOptions}
              modelLoading={modelLoading}
              modelError={modelError}
              onDiscoverModels={() => void handleDiscoverModels()}
            />
          ) : null}

          {section === "connection" ? (
            <>
              <Divider />
              <NetworkProxySection
                desktop={desktop}
                draft={proxy.draft}
                loading={proxy.loading}
                saving={saving}
                error={proxy.error}
                onChange={proxy.update}
                onRetry={proxy.retry}
              />
            </>
          ) : null}

        </Form>

        {section === "workspace" || section === "data" ? (
          <>
            <section {...stylex.props(styles.section)} aria-labelledby="local-records-heading">
          <div {...stylex.props(styles.sectionHeading)}>
            <div {...stylex.props(styles.headingWithStatus)}>
              <Typography.Title id="local-records-heading" level={5}>
                本地创作记录
              </Typography.Title>
              <Tag color={storageAvailable ? "green" : "warning"}>
                {storageAvailable ? "本地保存可用" : "当前仅临时保留"}
              </Tag>
            </div>
            <Typography.Paragraph type="secondary" {...stylex.props(styles.sectionCopy)}>
              应用会尝试将会话、消息和生成图片保存在当前设备的 IndexedDB 中；这些数据不是永久备份。
            </Typography.Paragraph>
          </div>

          <div {...stylex.props(styles.stats)}>
            <div {...stylex.props(styles.stat)}>
              <Database size={18} aria-hidden="true" />
              <span {...stylex.props(styles.statLabel)}>会话</span>
              <strong>{conversationCount.toLocaleString()}</strong>
            </div>
            <div {...stylex.props(styles.stat)}>
              <Database size={18} aria-hidden="true" />
              <span {...stylex.props(styles.statLabel)}>生成次数</span>
              <strong>{generationCount.toLocaleString()}</strong>
            </div>
          </div>

          <Button
            danger
            icon={<Trash2 size={16} />}
            loading={historyClearing}
            className={stylex.props(styles.dangerButton).className}
            onClick={confirmClearHistory}
          >
            清除创作记录
          </Button>
            </section>
          </>
        ) : null}

        {section === "connection" ? (
          <>
            <Divider />
            <section {...stylex.props(styles.section)} aria-labelledby="connection-reset-heading">
          <div {...stylex.props(styles.sectionHeading)}>
            <Typography.Title id="connection-reset-heading" level={5}>
              连接配置
            </Typography.Title>
            <Typography.Paragraph type="secondary" {...stylex.props(styles.sectionCopy)}>
              清除 API 基础地址与 API Key，并恢复画面比例和质量默认值。默认模型为 {IMAGE_MODEL}，创作记录与网络代理设置不受影响。
            </Typography.Paragraph>
          </div>
          <Button
            icon={<RotateCcw size={16} />}
            className={stylex.props(styles.warningButton).className}
            onClick={confirmReset}
            disabled={saving}
          >
            清除连接配置
          </Button>
            </section>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}

function previewGenerationEndpoint(baseUrl: string): string | null {
  try {
    return buildImageApiEndpoint(baseUrl, "images/generations");
  } catch {
    return null;
  }
}

function pickConversationCredentials(
  conversation: ConversationSettings,
): ConversationCredentialDraft {
  return {
    baseUrl: conversation.baseUrl,
    apiKey: conversation.apiKey,
    rememberApiKey: conversation.rememberApiKey,
  };
}

function hasEnabledConversationPlanning(conversation: ConversationSettings): boolean {
  const scopes = conversation.planningScopes;
  return scopes.single || scopes.batch || scopes.storyboard;
}

const styles = stylex.create({
  drawerTitle: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    paddingBottom: "8px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  sectionHeading: {
    display: "flex",
    flexDirection: "column",
  },
  sectionCopy: {
    marginTop: "-4px",
    marginBottom: 0,
    lineHeight: 1.65,
  },
  headingWithStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  stat: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    color: colors.ink,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  statLabel: {
    overflow: "hidden",
    color: colors.muted,
    fontSize: "13px",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dangerButton: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    transitionProperty: "color, background-color, border-color, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.dangerHover,
      backgroundColor: colors.dangerSoftHover,
      borderColor: colors.dangerHover,
    },
    ":active": {
      transform: "scale(0.98)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  warningButton: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderRadius: radii.small,
    transitionProperty: "color, background-color, border-color, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.warningHover,
      backgroundColor: colors.warningSoftHover,
      borderColor: colors.warningHover,
    },
    ":active": {
      transform: "scale(0.98)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  warningConfirmButton: {
    color: colors.surface,
    backgroundColor: colors.warning,
    borderColor: colors.warning,
    ":hover": {
      color: colors.surface,
      backgroundColor: colors.warningHover,
      borderColor: colors.warningHover,
    },
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
  },
  saveStatus: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontSize: "12px",
  },
  saveStatusDirty: { color: colors.warning },
  footerButton: {
    borderRadius: radii.pill,
  },
});
