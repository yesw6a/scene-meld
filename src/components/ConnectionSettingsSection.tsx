import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { AutoComplete, Button, Form, Input, Radio, Switch, Typography } from "antd";
import {
  CheckCircle2,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  ShieldAlert,
  RefreshCw,
  ArrowRight,
  Server,
} from "lucide-react";

import {
  DEFAULT_CONVERSATION_MODEL,
  type ConversationPlanningScopes,
  type ConversationSettings,
  type GenerationSettings,
} from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";
import ConversationPlanningScopeSelector from "./ConversationPlanningScopeSelector";

type ConnectionMode = "shared" | "separate";

interface ConnectionSettingsSectionProps {
  draft: GenerationSettings;
  desktop: boolean;
  endpointError?: string;
  conversationEndpointError?: string;
  requestEndpoint: string | null;
  requestHost: string;
  onUpdate: <Key extends keyof GenerationSettings>(
    key: Key,
    value: GenerationSettings[Key],
  ) => void;
  onUpdateConversation: <Key extends keyof ConversationSettings>(
    key: Key,
    value: ConversationSettings[Key],
  ) => void;
  onConnectionModeChange: (shared: boolean) => void;
  hasUnsavedChanges?: boolean;
  modelOptions?: string[];
  modelLoading?: boolean;
  modelError?: string;
  onDiscoverModels?: () => void;
}

export default function ConnectionSettingsSection({
  draft,
  desktop,
  endpointError,
  conversationEndpointError,
  requestEndpoint,
  requestHost,
  onUpdate,
  onUpdateConversation,
  onConnectionModeChange,
  hasUnsavedChanges = false,
  modelOptions = [],
  modelLoading = false,
  modelError,
  onDiscoverModels,
}: ConnectionSettingsSectionProps) {
  const shared = draft.conversation.shareImageConnection;
  const imageReady = Boolean(draft.baseUrl && draft.apiKey);
  const conversationReady = shared
    ? imageReady
    : Boolean(draft.conversation.baseUrl && draft.conversation.apiKey);
  const planningLabel = enabledConversationPlanningLabel(draft.conversation.planningScopes);
  const mode: ConnectionMode = shared ? "shared" : "separate";

  return (
    <section {...stylex.props(styles.section)} data-connection-settings="true" aria-labelledby="connection-heading">
      <div {...stylex.props(styles.sectionHeading)}>
        <Typography.Title id="connection-heading" level={5}>
          AI 规划范围与连接
        </Typography.Title>
        <Typography.Paragraph type="secondary" {...stylex.props(styles.sectionCopy)}>
          选择自动规划适用的生成模式，并配置规划与提示词优化共用的 AI 连接。
        </Typography.Paragraph>
      </div>

      <ConversationPlanningScopeSelector
        scopes={draft.conversation.planningScopes}
        hasUnsavedChanges={hasUnsavedChanges}
        onChange={(scope, checked) => onUpdateConversation("planningScopes", {
          ...draft.conversation.planningScopes,
          [scope]: checked,
        })}
      />

      <CredentialStorageNotice draft={draft} desktop={desktop} onUpdate={onUpdate} />

      <TopologySelector shared={shared} onChange={onConnectionModeChange} />

      <div key={mode} {...stylex.props(styles.modePanel, !shared && styles.modePanelWide)}>
        {shared ? (
          <SharedConnectionPanel
            draft={draft}
            desktop={desktop}
            endpointError={endpointError}
            requestEndpoint={requestEndpoint}
            requestHost={requestHost}
            onUpdate={onUpdate}
            onUpdateConversation={onUpdateConversation}
            planningLabel={planningLabel}
            hasUnsavedChanges={hasUnsavedChanges}
            modelOptions={modelOptions}
            modelLoading={modelLoading}
            modelError={modelError}
            onDiscoverModels={onDiscoverModels}
          />
        ) : (
          <div {...stylex.props(styles.channelGrid)}>
            <section {...stylex.props(styles.channelPanel)} aria-labelledby="image-channel-heading">
              <PanelHeading
                id="image-channel-heading"
                icon={<ImageIcon size={16} aria-hidden="true" />}
                title="图片生成连接"
                detail="固定模型：gpt-image-2"
                status={hasUnsavedChanges ? "未保存" : imageReady ? "已配置" : "待配置"}
                ready={imageReady}
                dirty={hasUnsavedChanges}
              />
              <ImageConnectionFields
                draft={draft}
                desktop={desktop}
                endpointError={endpointError}
                requestEndpoint={requestEndpoint}
                requestHost={requestHost}
                onUpdate={onUpdate}
              />
            </section>
            <section {...stylex.props(styles.channelPanel)} aria-labelledby="conversation-channel-heading">
              <PanelHeading
                id="conversation-channel-heading"
                icon={<MessageCircle size={16} aria-hidden="true" />}
                title="AI 辅助连接"
                detail={`自动规划：${planningLabel}；另供手动提示词优化`}
                status={hasUnsavedChanges ? "未保存" : conversationReady ? "已配置" : "待配置"}
                ready={conversationReady}
                dirty={hasUnsavedChanges}
              />
              <ConversationConnectionFields
                draft={draft}
                endpointError={conversationEndpointError}
                onUpdate={onUpdateConversation}
                modelOptions={modelOptions}
                modelLoading={modelLoading}
                modelError={modelError}
                onDiscoverModels={onDiscoverModels}
              />
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

function SharedConnectionPanel({
  draft,
  desktop,
  endpointError,
  requestEndpoint,
  requestHost,
  onUpdate,
  onUpdateConversation,
  planningLabel,
  hasUnsavedChanges,
  modelOptions,
  modelLoading,
  modelError,
  onDiscoverModels,
}: {
  draft: GenerationSettings;
  desktop: boolean;
  endpointError?: string;
  requestEndpoint: string | null;
  requestHost: string;
  onUpdate: ConnectionSettingsSectionProps["onUpdate"];
  onUpdateConversation: ConnectionSettingsSectionProps["onUpdateConversation"];
  planningLabel: string;
  hasUnsavedChanges: boolean;
  modelOptions?: string[];
  modelLoading?: boolean;
  modelError?: string;
  onDiscoverModels?: () => void;
}) {
  const imageReady = Boolean(draft.baseUrl && draft.apiKey);

  return (
    <section {...stylex.props(styles.channelPanel)} aria-labelledby="shared-channel-heading">
      <PanelHeading
        id="shared-channel-heading"
        icon={<Link2 size={16} aria-hidden="true" />}
        title="共用图片连接"
        detail="图片生成与已授权的 AI 辅助场景复用同一组凭据"
        status={hasUnsavedChanges ? "未保存" : imageReady ? "已配置" : "待配置"}
        ready={imageReady}
        dirty={hasUnsavedChanges}
      />
      <ImageConnectionFields
        draft={draft}
        desktop={desktop}
        endpointError={endpointError}
        requestEndpoint={requestEndpoint}
        requestHost={requestHost}
        onUpdate={onUpdate}
      />
      <div {...stylex.props(styles.panelDivider)} />
      <div {...stylex.props(styles.subsectionHeading)}>
        <MessageCircle size={16} aria-hidden="true" />
        <span {...stylex.props(styles.subsectionHeadingText)}>
          <strong>AI 辅助模型</strong>
          <small>自动规划：{planningLabel}；同时用于用户主动触发的提示词优化。</small>
        </span>
      </div>
      <div {...stylex.props(styles.fieldStack)}>
        <ConversationCapabilityFields draft={draft} onUpdate={onUpdateConversation} modelOptions={modelOptions} modelLoading={modelLoading} modelError={modelError} onDiscoverModels={onDiscoverModels} />
      </div>
    </section>
  );
}

function PanelHeading({
  id,
  icon,
  title,
  detail,
  status,
  ready,
  muted,
  dirty,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  detail: string;
  status: string;
  ready: boolean;
  muted?: boolean;
  dirty?: boolean;
}) {
  return (
    <div {...stylex.props(styles.panelHeading)}>
      <div {...stylex.props(styles.panelTitleGroup)}>
        <span {...stylex.props(styles.panelIcon, muted ? styles.panelIconMuted : dirty ? styles.panelIconDirty : ready ? styles.panelIconReady : styles.panelIconPending)}>
          {ready && !muted && !dirty ? <CheckCircle2 size={16} aria-hidden="true" /> : icon}
        </span>
        <span {...stylex.props(styles.panelHeadingCopy)}>
          <strong id={id}>{title}</strong>
          <small>{detail}</small>
        </span>
      </div>
      <span {...stylex.props(styles.panelStatus, muted ? styles.panelStatusMuted : dirty ? styles.panelStatusDirty : ready ? styles.panelStatusReady : styles.panelStatusPending)}>
        {status}
      </span>
    </div>
  );
}

function ImageConnectionFields({
  draft,
  desktop,
  endpointError,
  requestEndpoint,
  requestHost,
  onUpdate,
}: {
  draft: GenerationSettings;
  desktop: boolean;
  endpointError?: string;
  requestEndpoint: string | null;
  requestHost: string;
  onUpdate: ConnectionSettingsSectionProps["onUpdate"];
}) {
  return (
    <div {...stylex.props(styles.fieldStack)}>
      <Form.Item
        label="API 基础地址"
        required
        validateStatus={endpointError ? "error" : undefined}
        help={endpointError || `${desktop ? "桌面正式构建" : "Web 版"} 仅支持 HTTPS，地址通常以 /v1 结尾。`}
      >
        <Input
          value={draft.baseUrl}
          inputMode="url"
          autoComplete="url"
          placeholder="https://relay.example.com/v1"
          onChange={(event) => onUpdate("baseUrl", event.target.value)}
        />
      </Form.Item>
      <div {...stylex.props(styles.endpointPreview)} aria-live="polite">
        <span>{requestHost ? `API Key 将发送至 ${requestHost}` : "实际请求"}</span>
        <code>{requestEndpoint ? `POST ${requestEndpoint}` : "填写有效地址后显示"}</code>
        {requestHost ? <small>本项目不提供图片请求中转服务。</small> : null}
      </div>
      <Form.Item
        label="API Key"
        required
        help={requestHost ? `生成请求将发送到 ${requestHost}。` : "生成请求将发送到目标 Endpoint。"}
      >
        <Input.Password
          value={draft.apiKey}
          autoComplete="off"
          placeholder="输入 API Key"
          onChange={(event) => onUpdate("apiKey", event.target.value)}
        />
      </Form.Item>
    </div>
  );
}

function TopologySelector({
  shared,
  onChange,
}: {
  shared: boolean;
  onChange: (shared: boolean) => void;
}) {
  return (
    <fieldset {...stylex.props(styles.topologyFieldset)}>
      <legend {...stylex.props(styles.modeLegend)}>AI 辅助连接</legend>
      <Radio.Group
        value={shared ? "unified" : "independent"}
        onChange={(event) => onChange(event.target.value === "unified")}
        {...stylex.props(styles.topologyOptions)}
      >
        <Radio value="unified" {...stylex.props(styles.topologyOption, shared && styles.topologyOptionActive)}>
          <TopologyDiagram shared active={shared} />
          <span {...stylex.props(styles.topologyCopy)}>
            <strong>共用图片连接</strong>
            <small>AI 自动规划和手动提示词优化使用图片连接配置。</small>
          </span>
          {shared ? <CheckCircle2 size={17} aria-hidden="true" {...stylex.props(styles.topologyOptionMark)} /> : null}
        </Radio>
        <Radio value="independent" {...stylex.props(styles.topologyOption, !shared && styles.topologyOptionActive)}>
          <TopologyDiagram shared={false} active={!shared} />
          <span {...stylex.props(styles.topologyCopy)}>
            <strong>单独配置 AI 连接</strong>
            <small>为 AI 自动规划和手动提示词优化填写独立凭据。</small>
          </span>
          {!shared ? <CheckCircle2 size={17} aria-hidden="true" {...stylex.props(styles.topologyOptionMark)} /> : null}
        </Radio>
      </Radio.Group>
    </fieldset>
  );
}

function TopologyDiagram({ shared, active }: { shared: boolean; active: boolean }) {
  return (
    <span {...stylex.props(styles.topologyDiagram, active && styles.topologyDiagramActive)} aria-hidden="true">
      {shared ? (
        <>
          <span {...stylex.props(styles.topologySourceStack)}>
            <ImageIcon size={15} strokeWidth={2} />
            <MessageCircle size={15} strokeWidth={2} />
          </span>
          <span {...stylex.props(styles.topologySharedArrows)}>
            <ArrowRight size={13} strokeWidth={2.2} />
            <ArrowRight size={13} strokeWidth={2.2} />
          </span>
          <Server size={22} strokeWidth={1.8} />
        </>
      ) : (
        <span {...stylex.props(styles.topologySeparateRows)}>
          <span {...stylex.props(styles.topologySeparateRow)}>
            <ImageIcon size={14} strokeWidth={2} />
            <ArrowRight size={11} strokeWidth={2.2} />
            <Server size={17} strokeWidth={1.8} />
          </span>
          <span {...stylex.props(styles.topologySeparateRow)}>
            <MessageCircle size={14} strokeWidth={2} />
            <ArrowRight size={11} strokeWidth={2.2} />
            <Server size={17} strokeWidth={1.8} />
          </span>
        </span>
      )}
    </span>
  );
}

function CredentialStorageNotice({
  draft,
  desktop,
  onUpdate,
}: {
  draft: GenerationSettings;
  desktop: boolean;
  onUpdate: ConnectionSettingsSectionProps["onUpdate"];
}) {
  const copy = draft.conversation.shareImageConnection
    ? "当前保存图片生成与 AI 辅助共用的凭据。"
    : "当前保存图片生成与 AI 辅助各自的凭据。";
  return (
    <section {...stylex.props(styles.securityPanel)} aria-labelledby="credential-storage-heading">
      <div {...stylex.props(styles.securityHeading)}>
        <span {...stylex.props(styles.securityIcon)}><ShieldAlert size={16} aria-hidden="true" /></span>
        <span {...stylex.props(styles.switchCopy)}>
          <strong id="credential-storage-heading">{desktop ? "使用系统凭据管理器" : "记住已配置的连接凭据"}</strong>
          <small>{desktop ? copy : "下次打开应用时尝试恢复已填写的 API Key。"}</small>
        </span>
        <Switch checked={draft.rememberApiKey} onChange={(checked) => onUpdate("rememberApiKey", checked)} />
      </div>
      <small {...stylex.props(styles.securityDetail)}>
        {desktop ? "桌面端使用系统凭据管理器；是否自动规划不会改变凭据保存规则。" : "Web 端将保存在当前浏览器，同源脚本和扩展可能读取 localStorage。"}
      </small>
    </section>
  );
}

function ConversationConnectionFields({
  draft,
  endpointError,
  onUpdate,
  modelOptions,
  modelLoading,
  modelError,
  onDiscoverModels,
}: {
  draft: GenerationSettings;
  endpointError?: string;
  onUpdate: ConnectionSettingsSectionProps["onUpdateConversation"];
  modelOptions?: string[];
  modelLoading?: boolean;
  modelError?: string;
  onDiscoverModels?: () => void;
}) {
  const planningEnabled = hasEnabledConversationPlanning(draft.conversation);
  return (
    <div {...stylex.props(styles.fieldStack)}>
      <div {...stylex.props(styles.independentFields)}>
        <Form.Item
          label="AI 辅助 Endpoint"
          required={planningEnabled}
          validateStatus={endpointError ? "error" : undefined}
          help={endpointError}
        >
          <Input
            value={draft.conversation.baseUrl}
            placeholder="https://relay.example.com/v1"
            onChange={(event) => onUpdate("baseUrl", event.target.value)}
          />
        </Form.Item>
        <Form.Item label="AI 辅助 API Key" required={planningEnabled}>
          <Input.Password
            value={draft.conversation.apiKey}
            autoComplete="off"
            placeholder="输入 AI 辅助模型 API Key"
            onChange={(event) => onUpdate("apiKey", event.target.value)}
          />
        </Form.Item>
      </div>
      <div {...stylex.props(styles.panelDivider)} />
      <ConversationCapabilityFields draft={draft} onUpdate={onUpdate} modelOptions={modelOptions} modelLoading={modelLoading} modelError={modelError} onDiscoverModels={onDiscoverModels} />
    </div>
  );
}

function ConversationCapabilityFields({
  draft,
  onUpdate,
  modelOptions = [],
  modelLoading = false,
  modelError,
  onDiscoverModels,
}: {
  draft: GenerationSettings;
  onUpdate: ConnectionSettingsSectionProps["onUpdateConversation"];
  modelOptions?: string[];
  modelLoading?: boolean;
  modelError?: string;
  onDiscoverModels?: () => void;
}) {
  return (
    <div {...stylex.props(styles.revealedFields)}>
      <Form.Item
        label="AI 辅助模型"
        help={modelError || (modelOptions.length ? `已从当前服务获取 ${modelOptions.length} 个模型。` : "模型名称由上游服务决定，也可以手动填写。")}
        validateStatus={modelError ? "error" : undefined}
      >
        <div {...stylex.props(styles.modelPickerRow)}>
          <AutoComplete
            value={draft.conversation.model}
            options={modelOptions.map((model) => ({ value: model, label: model }))}
            filterOption={(inputValue, option) => {
              const query = inputValue.trim().toLowerCase();
              const currentModel = draft.conversation.model.trim().toLowerCase();
              if (!query || query === currentModel) {
                return true;
              }
              return String(option?.value ?? "").toLowerCase().includes(query);
            }}
            onChange={(value) => onUpdate("model", value)}
            onSelect={(value) => onUpdate("model", value)}
            placeholder={`例如 ${DEFAULT_CONVERSATION_MODEL}`}
            notFoundContent="未匹配模型，可继续手动输入"
            {...stylex.props(styles.modelAutocomplete)}
          />
          <Button
            icon={<RefreshCw size={14} />}
            loading={modelLoading}
            disabled={!onDiscoverModels}
            aria-label="获取模型列表"
            onClick={onDiscoverModels}
            {...stylex.props(styles.modelDiscoveryButton)}
          >
            获取模型
          </Button>
        </div>
      </Form.Item>
      <label {...stylex.props(styles.switchRow)}>
        <span {...stylex.props(styles.switchCopy)}>
          <strong>结构化 JSON 输出</strong>
          <small>端点支持 response_format 时开启。</small>
        </span>
        <Switch checked={draft.conversation.supportsStructuredOutput} onChange={(checked) => onUpdate("supportsStructuredOutput", checked)} />
      </label>
    </div>
  );
}

function hasEnabledConversationPlanning(conversation: ConversationSettings): boolean {
  const scopes = conversation.planningScopes;
  return scopes.single || scopes.batch || scopes.storyboard;
}

function enabledConversationPlanningLabel(scopes: ConversationPlanningScopes): string {
  const labels = [
    scopes.single ? "单图" : "",
    scopes.batch ? "多图" : "",
    scopes.storyboard ? "分镜" : "",
  ].filter(Boolean);
  return labels.join("、") || "已关闭";
}

const modePanelEnter = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(6px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  section: { display: "flex", flexDirection: "column", gap: "16px" },
  sectionHeading: { display: "flex", flexDirection: "column" },
  sectionCopy: { marginTop: "-4px", marginBottom: 0, lineHeight: 1.65 },
  modeLegend: { padding: 0, marginBottom: "8px", color: colors.ink, fontSize: "13px", fontWeight: 600 },
  topologyFieldset: { minWidth: 0, padding: 0, margin: 0, borderWidth: 0 },
  topologyOptions: { width: "100%", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", "@media (max-width: 560px)": { gridTemplateColumns: "1fr" } },
  topologyOption: { position: "relative", width: "100%", minWidth: 0, minHeight: "96px", display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 42px 14px 14px", boxSizing: "border-box", whiteSpace: "normal", color: colors.ink, backgroundColor: colors.glassSubtle, borderWidth: "1px", borderStyle: "solid", borderColor: colors.glassBorder, borderRadius: radii.medium, cursor: "pointer", transitionProperty: "background-color, border-color, box-shadow, transform", transitionDuration: motion.fast, transitionTimingFunction: motion.easing, ":hover": { backgroundColor: colors.primarySoft }, ":focus-within": { boxShadow: shadows.focus }, ":active": { transform: "scale(0.99)" }, "@media (prefers-reduced-motion: reduce)": { transitionDuration: "0ms", transform: "none" } },
  topologyOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary, boxShadow: `inset 0 0 0 1px ${colors.primary}` },
  topologyOptionMark: { position: "absolute", top: "14px", right: "14px", color: colors.primary },
  topologyCopy: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "5px", overflowWrap: "normal" },
  topologyDiagram: { width: "74px", minHeight: "44px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: colors.subtle },
  topologyDiagramActive: { color: colors.primary },
  topologySourceStack: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: "34px" },
  topologySharedArrows: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: "34px", color: "currentColor", opacity: 0.8 },
  topologySeparateRows: { display: "flex", flexDirection: "column", gap: "4px", width: "100%" },
  topologySeparateRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px", width: "100%" },
  securityPanel: { minWidth: 0, display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", backgroundColor: colors.glassSubtle, borderWidth: "1px", borderStyle: "solid", borderColor: colors.glassBorder, borderRadius: radii.medium },
  securityHeading: { minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  securityIcon: { width: "28px", height: "28px", flexShrink: 0, display: "grid", placeItems: "center", color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radii.small },
  securityDetail: { paddingLeft: "38px", color: colors.muted, lineHeight: 1.5 },
  modePanel: {
    animationName: modePanelEnter,
    animationDuration: motion.standard,
    animationTimingFunction: motion.easing,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": { animationName: "none" },
  },
  modePanelWide: {
    animationDelay: "90ms",
    "@media (prefers-reduced-motion: reduce)": { animationDelay: "0ms" },
  },
  channelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 700px)": { gridTemplateColumns: "1fr" },
  },
  channelPanel: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    backgroundColor: "transparent",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  panelHeading: { minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" },
  panelTitleGroup: { minWidth: 0, display: "flex", alignItems: "flex-start", gap: "9px" },
  panelIcon: { width: "28px", height: "28px", flexShrink: 0, display: "grid", placeItems: "center", borderRadius: radii.small },
  panelIconReady: { color: colors.success, backgroundColor: colors.successSoft },
  panelIconDirty: { color: colors.warning, backgroundColor: colors.warningSoft },
  panelIconPending: { color: colors.muted, backgroundColor: colors.glassSubtle },
  panelIconMuted: { color: colors.subtle, backgroundColor: colors.glassSubtle },
  panelHeadingCopy: { minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
  panelStatus: { flexShrink: 0, paddingTop: "4px", fontSize: "12px", whiteSpace: "nowrap" },
  panelStatusReady: { color: colors.success },
  panelStatusDirty: { color: colors.warning },
  panelStatusPending: { color: colors.warning },
  panelStatusMuted: { color: colors.subtle },
  fieldStack: { minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" },
  independentFields: { display: "flex", flexDirection: "column", gap: "4px" },
  revealedFields: { display: "flex", flexDirection: "column", gap: "12px" },
  subsectionHeading: { display: "flex", alignItems: "flex-start", gap: "8px", color: colors.primary },
  subsectionHeadingText: { minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
  panelDivider: { width: "100%", height: "1px", backgroundColor: colors.glassBorder },
  endpointPreview: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    padding: "11px 12px",
    marginTop: "-4px",
    color: colors.muted,
    fontSize: "12px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  modelPickerRow: { minWidth: 0, display: "flex", alignItems: "stretch", gap: "8px" },
  modelAutocomplete: { minWidth: 0, flex: 1 },
  modelDiscoveryButton: { flexShrink: 0, minHeight: "40px" },
  switchRow: { minHeight: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", cursor: "pointer", color: colors.ink },
  switchCopy: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
});
