import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { Alert, AutoComplete, Button, Form, Input, Radio, Switch, Typography } from "antd";
import {
  CheckCircle2,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  ArrowRight,
  Server,
} from "lucide-react";

import { DEFAULT_CONVERSATION_MODEL, type ConversationSettings, type GenerationSettings } from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";

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
  const mode: ConnectionMode = shared ? "shared" : "separate";

  return (
    <section {...stylex.props(styles.section)} data-connection-settings="true" aria-labelledby="connection-heading">
      <div {...stylex.props(styles.sectionHeading)}>
        <Typography.Title id="connection-heading" level={5}>
          规划引擎
        </Typography.Title>
        <Typography.Paragraph type="secondary" {...stylex.props(styles.sectionCopy)}>
          先选择分镜规划方式；启用 AI 规划后，再选择连接方式并完成对应凭据配置。
        </Typography.Paragraph>
      </div>

      <CredentialStorageNotice draft={draft} desktop={desktop} onUpdate={onUpdate} />

      <fieldset {...stylex.props(styles.modeFieldset)}>
        <legend {...stylex.props(styles.modeLegend)}>分镜规划方式</legend>
        <Radio.Group
          value={draft.conversation.enabled ? "ai" : "builtin"}
          onChange={(event) => onUpdateConversation("enabled", event.target.value === "ai")}
          {...stylex.props(styles.planningOptions)}
        >
          <Radio value="builtin" {...stylex.props(styles.planningOption, !draft.conversation.enabled && styles.planningOptionActive)}>
            <span {...stylex.props(styles.planningOptionIcon, !draft.conversation.enabled && styles.planningOptionIconActive)}>
              <ImageIcon size={17} aria-hidden="true" />
            </span>
            <span {...stylex.props(styles.modeOptionCopy)}>
              <strong>内置规划</strong>
              <small>不调用对话模型，使用应用内置分镜模板。</small>
            </span>
            {!draft.conversation.enabled ? <CheckCircle2 size={17} aria-hidden="true" {...stylex.props(styles.planningOptionMark)} /> : null}
          </Radio>
          <Radio value="ai" {...stylex.props(styles.planningOption, draft.conversation.enabled && styles.planningOptionActive)}>
            <span {...stylex.props(styles.planningOptionIcon, draft.conversation.enabled && styles.planningOptionIconActive)}>
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <span {...stylex.props(styles.modeOptionCopy)}>
              <strong>AI 规划</strong>
              <small>让对话模型理解内容并生成连续分镜。</small>
            </span>
            {draft.conversation.enabled ? <CheckCircle2 size={17} aria-hidden="true" {...stylex.props(styles.planningOptionMark)} /> : null}
          </Radio>
        </Radio.Group>
      </fieldset>

      {draft.conversation.enabled ? (
        <TopologySelector shared={shared} onChange={onConnectionModeChange} />
      ) : null}

      <div key={`${draft.conversation.enabled ? "ai" : "builtin"}-${mode}`} {...stylex.props(styles.modePanel, draft.conversation.enabled && !shared && styles.modePanelWide)}>
        {!draft.conversation.enabled ? (
          <ImageOnlyConnectionPanel
            draft={draft}
            desktop={desktop}
            endpointError={endpointError}
            requestEndpoint={requestEndpoint}
            requestHost={requestHost}
            onUpdate={onUpdate}
          />
        ) : shared ? (
          <SharedConnectionPanel
            draft={draft}
            desktop={desktop}
            endpointError={endpointError}
            requestEndpoint={requestEndpoint}
            requestHost={requestHost}
            onUpdate={onUpdate}
            onUpdateConversation={onUpdateConversation}
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
                status={imageReady ? "已配置" : "待配置"}
                ready={imageReady}
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
                title="AI 规划连接"
                detail="用于分镜规划"
                status={conversationReady ? "已配置" : "待配置"}
                ready={conversationReady}
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
        detail="图片生成与 AI 规划复用同一组凭据"
        status={imageReady ? "已配置" : "待配置"}
        ready={imageReady}
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
          <strong>AI 规划模型</strong>
          <small>复用上方接入，用于理解内容并生成连续分镜。</small>
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
}: {
  id: string;
  icon: ReactNode;
  title: string;
  detail: string;
  status: string;
  ready: boolean;
  muted?: boolean;
}) {
  return (
    <div {...stylex.props(styles.panelHeading)}>
      <div {...stylex.props(styles.panelTitleGroup)}>
        <span {...stylex.props(styles.panelIcon, muted ? styles.panelIconMuted : ready ? styles.panelIconReady : styles.panelIconPending)}>
          {ready && !muted ? <CheckCircle2 size={16} aria-hidden="true" /> : icon}
        </span>
        <span {...stylex.props(styles.panelHeadingCopy)}>
          <strong id={id}>{title}</strong>
          <small>{detail}</small>
        </span>
      </div>
      <span {...stylex.props(styles.panelStatus, muted ? styles.panelStatusMuted : ready ? styles.panelStatusReady : styles.panelStatusPending)}>
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

function ImageOnlyConnectionPanel({
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
    <section {...stylex.props(styles.channelPanel)} aria-labelledby="image-only-heading">
      <PanelHeading
        id="image-only-heading"
        icon={<ImageIcon size={16} aria-hidden="true" />}
        title="图片生成连接"
        detail="当前使用内置分镜规划，固定模型：gpt-image-2"
        status={draft.baseUrl && draft.apiKey ? "已配置" : "待配置"}
        ready={Boolean(draft.baseUrl && draft.apiKey)}
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
      <legend {...stylex.props(styles.modeLegend)}>AI 规划连接</legend>
      <Radio.Group
        value={shared ? "unified" : "independent"}
        onChange={(event) => onChange(event.target.value === "unified")}
        {...stylex.props(styles.topologyOptions)}
      >
        <Radio value="unified" {...stylex.props(styles.topologyOption, shared && styles.topologyOptionActive)}>
          <TopologyDiagram shared active={shared} />
          <span {...stylex.props(styles.topologyCopy)}>
            <strong>共用图片连接</strong>
            <small>AI 规划直接使用上面的图片连接配置。</small>
          </span>
          {shared ? <CheckCircle2 size={17} aria-hidden="true" {...stylex.props(styles.topologyOptionMark)} /> : null}
        </Radio>
        <Radio value="independent" {...stylex.props(styles.topologyOption, !shared && styles.topologyOptionActive)}>
          <TopologyDiagram shared={false} active={!shared} />
          <span {...stylex.props(styles.topologyCopy)}>
            <strong>单独配置 AI 连接</strong>
            <small>为 AI 规划填写独立的 Endpoint 和 API Key。</small>
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
  const copy = !draft.conversation.enabled
    ? "当前保存图片生成凭据。"
    : draft.conversation.shareImageConnection
      ? "当前保存图片生成与 AI 规划共用的凭据。"
      : "当前保存图片生成与 AI 规划各自的凭据。";
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
        {desktop ? "桌面端使用系统凭据管理器；AI 规划关闭时，未启用的对话凭据不会写入其中。" : "Web 端将保存在当前浏览器，同源脚本和扩展可能读取 localStorage。"}
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
  return (
    <div {...stylex.props(styles.fieldStack)}>
      <div {...stylex.props(styles.independentFields)}>
        <Form.Item
          label="AI 规划 Endpoint"
          required={draft.conversation.enabled}
          validateStatus={endpointError ? "error" : undefined}
          help={endpointError}
        >
          <Input
            value={draft.conversation.baseUrl}
            placeholder="https://relay.example.com/v1"
            onChange={(event) => onUpdate("baseUrl", event.target.value)}
          />
        </Form.Item>
        <Form.Item label="AI 规划 API Key" required={draft.conversation.enabled}>
          <Input.Password
            value={draft.conversation.apiKey}
            autoComplete="off"
            placeholder="输入对话 AI API Key"
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
        label="对话模型"
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

const modePanelEnter = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(6px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  section: { display: "flex", flexDirection: "column", gap: "16px" },
  sectionHeading: { display: "flex", flexDirection: "column" },
  sectionCopy: { marginTop: "-4px", marginBottom: 0, lineHeight: 1.65 },
  modeFieldset: { minWidth: 0, padding: 0, margin: 0, borderWidth: 0 },
  modeLegend: { padding: 0, marginBottom: "8px", color: colors.ink, fontSize: "13px", fontWeight: 600 },
  planningOptions: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    "@media (max-width: 560px)": { gridTemplateColumns: "1fr" },
  },
  planningOption: {
    position: "relative",
    width: "100%",
    minWidth: 0,
    minHeight: "86px",
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    padding: "13px 42px 13px 12px",
    boxSizing: "border-box",
    whiteSpace: "normal",
    color: colors.ink,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
    cursor: "pointer",
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": { backgroundColor: colors.primarySoft },
    ":focus-within": { boxShadow: shadows.focus },
  },
  planningOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary, boxShadow: `inset 0 0 0 1px ${colors.primary}` },
  planningOptionIcon: { width: "30px", height: "30px", display: "grid", placeItems: "center", color: colors.muted, backgroundColor: colors.glassSubtle, borderRadius: radii.small },
  planningOptionIconActive: { color: colors.primary, backgroundColor: colors.primarySoftHover },
  modeOptionCopy: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
  planningOptionMark: { position: "absolute", top: "13px", right: "13px", color: colors.primary },
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
  panelIconPending: { color: colors.muted, backgroundColor: colors.glassSubtle },
  panelIconMuted: { color: colors.subtle, backgroundColor: colors.glassSubtle },
  panelHeadingCopy: { minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
  panelStatus: { flexShrink: 0, paddingTop: "4px", fontSize: "12px", whiteSpace: "nowrap" },
  panelStatusReady: { color: colors.success },
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
