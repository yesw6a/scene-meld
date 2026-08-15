import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  App as AntdApp,
  Select,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  Check,
  Database,
  KeyRound,
  RotateCcw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import {
  IMAGE_SIZE_OPTIONS,
  imageSizeLabel,
  type ImageSizeOption,
} from "../lib/image-sizes";
import {
  buildImageApiEndpoint,
  endpointHostLabel,
  normalizeImageApiBaseUrl,
} from "../lib/image-endpoint";
import { isDesktopRuntime } from "../lib/runtime";
import { IMAGE_MODEL, type GenerationSettings, type ImageQuality, type ImageSize } from "../types";
import { colors, motion, radii } from "../styles/tokens.stylex";

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
  const { modal } = AntdApp.useApp();
  const [draft, setDraft] = useState(settings);
  const [endpointError, setEndpointError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const desktop = isDesktopRuntime();
  const dataOnly = section === "data";
  const requestEndpoint = previewGenerationEndpoint(draft.baseUrl);
  const requestHost = endpointHostLabel(draft.baseUrl, "");

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setEndpointError(undefined);
      setFormError(undefined);
    }
  }, [open, section, settings]);

  const updateDraft = <Key extends keyof GenerationSettings>(
    key: Key,
    value: GenerationSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (dataOnly) {
      return;
    }

    if (section === "workspace") {
      setFormError(undefined);
      setSaving(true);
      try {
        await onSave({ ...draft, model: IMAGE_MODEL });
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
      setFormError(undefined);
      return;
    }

    const trimmed = {
      ...draft,
      baseUrl: normalizedBaseUrl,
      apiKey: draft.apiKey.trim(),
      model: IMAGE_MODEL,
    };

    if (!trimmed.apiKey) {
      setEndpointError(undefined);
      setFormError("请填写 API Key。");
      return;
    }

    setEndpointError(undefined);
    setFormError(undefined);
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await onReset();
    setEndpointError(undefined);
    setFormError(undefined);
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
            ? "连接信息"
            : section === "data"
              ? "本地数据"
              : "工作区设置"}
        </span>
      }
      width="min(420px, 100vw)"
      open={open}
      rootClassName="studio-glass-drawer"
      onClose={onClose}
      footer={
        <div {...stylex.props(styles.footer)}>
          <Button className={stylex.props(styles.footerButton).className} onClick={onClose}>
            {dataOnly ? "关闭" : "取消"}
          </Button>
          {!dataOnly ? (
            <Button
              type="primary"
              icon={<Save size={16} />}
              loading={saving}
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
        <Form layout="vertical" requiredMark="optional">
          {formError ? <Alert type="error" showIcon message={formError} /> : null}

          {section === "connection" ? (
            <>
              <section {...stylex.props(styles.section)} aria-labelledby="connection-heading">
            <div {...stylex.props(styles.sectionHeading)}>
              <Typography.Title id="connection-heading" level={5}>
                {desktop ? "设备直连" : "API 直连"}
              </Typography.Title>
              <Typography.Paragraph type="secondary" {...stylex.props(styles.sectionCopy)}>
                {desktop
                  ? "图片请求由桌面应用发送到你填写的兼容 Endpoint；本项目不提供图片请求中转服务，桌面版不受浏览器 CORS 限制。"
                  : "SceneMeld Web 是纯静态页面，浏览器会将图片请求发送到你填写的兼容 Endpoint；目标服务需要支持 CORS。"}
              </Typography.Paragraph>
            </div>

            <Form.Item
              label="API 基础地址"
              required
              validateStatus={endpointError ? "error" : undefined}
              help={
                endpointError ||
                `${desktop ? "桌面正式构建" : "Web 版"}仅支持 HTTPS，地址通常以 /v1 结尾。`
              }
            >
              <Input
                value={draft.baseUrl}
                inputMode="url"
                autoComplete="url"
                placeholder="https://relay.example.com/v1"
                onChange={(event) => updateDraft("baseUrl", event.target.value)}
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
              help={
                requestHost
                  ? `生成请求会发送到 ${requestHost}；本项目不提供图片请求中转服务。`
                  : "生成请求会发送到目标 Endpoint；本项目不提供图片请求中转服务。"
              }
            >
              <Input.Password
                value={draft.apiKey}
                autoComplete="off"
                placeholder="输入 API Key"
                onChange={(event) => updateDraft("apiKey", event.target.value)}
              />
            </Form.Item>

            <label {...stylex.props(styles.switchRow)}>
              <span>
                <strong>{desktop ? "尝试保存 API Key 到系统凭据管理器" : "保存 API Key 到此浏览器"}</strong>
                <small>
                  {draft.rememberApiKey
                    ? desktop
                      ? "应用会尝试在重新打开时读取；具体保护能力取决于系统和账户配置。"
                      : "刷新页面后仍会保留。"
                    : desktop
                      ? "仅保留到本次应用会话结束。"
                      : "仅保留到页面刷新前。"}
                </small>
              </span>
              <Switch
                checked={draft.rememberApiKey}
                onChange={(checked) => updateDraft("rememberApiKey", checked)}
              />
            </label>

            {draft.rememberApiKey ? (
              <Alert
                showIcon
                icon={<ShieldAlert size={18} />}
                type={desktop ? "info" : "warning"}
                message={desktop ? "尝试使用系统凭据管理器" : "浏览器本地保存"}
                description={
                  desktop
                    ? "应用会请求操作系统凭据管理器保存 API Key；具体保护能力取决于操作系统和账户配置。"
                    : "API Key 会写入此浏览器的 localStorage，同源脚本和浏览器扩展可能读取它。"
                }
              />
            ) : null}
              </section>
            </>
          ) : null}

          {section === "workspace" ? (
            <section {...stylex.props(styles.section)} aria-labelledby="generation-heading">
            <div {...stylex.props(styles.sectionHeading)}>
              <Typography.Title id="generation-heading" level={5}>
                生成默认值
              </Typography.Title>
              <Typography.Paragraph type="secondary" {...stylex.props(styles.sectionCopy)}>
                模型固定为 gpt-image-2；画面比例和质量也可以在输入框下方快速切换。
              </Typography.Paragraph>
            </div>

            <Form.Item label="模型">
              <div {...stylex.props(styles.fixedModel)}>
                <Tag color="blue">{IMAGE_MODEL}</Tag>
                <span {...stylex.props(styles.fixedModelHint)}>当前版本固定使用此模型</span>
              </div>
            </Form.Item>

            <div {...stylex.props(styles.twoColumns)}>
              <Form.Item label="画面比例">
                <Select<ImageSize>
                  value={draft.size}
                  options={IMAGE_SIZE_OPTIONS_FOR_SELECT}
                  labelRender={({ value }) => imageSizeLabel(value as ImageSize)}
                  optionRender={(option) => {
                    const sizeOption = option.data as ImageSizeOption;
                    const selected = sizeOption.value === draft.size;

                    return (
                      <div {...stylex.props(styles.sizeOption)}>
                        <span {...stylex.props(styles.sizeOptionCopy)}>
                          <strong {...stylex.props(styles.sizeOptionTitle)}>
                            {`${sizeOption.label} · ${sizeOption.ratio}`}
                          </strong>
                          <small {...stylex.props(styles.sizeOptionDimensions)}>
                            {sizeOption.dimensions}
                          </small>
                        </span>
                        {selected ? (
                          <Check
                            size={15}
                            strokeWidth={2.2}
                            aria-hidden="true"
                            {...stylex.props(styles.sizeOptionCheck)}
                          />
                        ) : null}
                      </div>
                    );
                  }}
                  popupMatchSelectWidth={260}
                  classNames={{
                    popup: {
                      root: "studio-select-popup studio-ratio-select-popup",
                      listItem: "studio-select-option",
                    },
                  }}
                  onChange={(value) => updateDraft("size", value)}
                />
              </Form.Item>
              <Form.Item label="图片质量">
                <Select<ImageQuality>
                  value={draft.quality}
                  options={QUALITY_OPTIONS}
                  classNames={{
                    popup: {
                      root: "studio-select-popup studio-quality-select-popup",
                      listItem: "studio-select-option",
                    },
                  }}
                  onChange={(value) => updateDraft("quality", value)}
                />
              </Form.Item>
            </div>
            </section>
          ) : null}
        </Form>

        {section === "workspace" || section === "data" ? (
          <>
            {section === "workspace" ? <Divider /> : null}
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
              清除 API 基础地址与 API Key，并恢复画面比例和质量默认值。模型固定为 gpt-image-2，创作记录不受影响。
            </Typography.Paragraph>
          </div>
          <Button
            icon={<RotateCcw size={16} />}
            className={stylex.props(styles.warningButton).className}
            onClick={confirmReset}
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

const QUALITY_OPTIONS = [
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
] satisfies { label: string; value: ImageQuality }[];

const IMAGE_SIZE_OPTIONS_FOR_SELECT = IMAGE_SIZE_OPTIONS.map((option) => ({ ...option }));

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
  sizeOption: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  sizeOptionCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    lineHeight: 1.25,
  },
  sizeOptionTitle: {
    color: colors.ink,
    fontSize: "13px",
    fontWeight: 600,
  },
  sizeOptionDimensions: {
    color: colors.muted,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
  },
  sizeOptionCheck: {
    flexShrink: 0,
    color: colors.primary,
  },
  headingWithStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  endpointPreview: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    padding: "11px 12px",
    marginTop: "-8px",
    marginBottom: "10px",
    color: colors.muted,
    fontSize: "12px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  fixedModel: {
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  fixedModelHint: {
    color: colors.muted,
    fontSize: "12px",
  },
  switchRow: {
    minHeight: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    cursor: "pointer",
    color: colors.ink,
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "12px",
    "@media (max-width: 520px)": {
      gridTemplateColumns: "1fr",
      gap: 0,
    },
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
  footerButton: {
    borderRadius: radii.pill,
  },
});
