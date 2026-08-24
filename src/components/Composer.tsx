import { useMemo, useRef, useState, type ComponentRef, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Attachments, Sender } from "@ant-design/x";
import { Button, Select, Tag, Tooltip, Upload } from "antd";
import { AlertCircle, Check, ImagePlus, WandSparkles } from "lucide-react";

import {
  formatImageAttachmentBytes,
  IMAGE_ATTACHMENT_ACCEPT,
  MAX_IMAGE_ATTACHMENT_COUNT,
} from "../lib/image-attachments";
import {
  IMAGE_SIZE_OPTIONS,
  imageSizeLabel,
  type ImageSizeOption,
} from "../lib/image-sizes";
import { parsePromptDirectives } from "../lib/prompt-directives";
import PromptEditorSizeControl, {
  type PromptEditorSizeMode,
} from "./PromptEditorSizeControl";
import type {
  DraftImageAttachment,
  GenerationSettings,
  GenerationMode,
  ImageQuality,
  ImageSize,
} from "../types";
import { colors, materials, motion, radii, shadows } from "../styles/tokens.stylex";

interface ComposerProps {
  value: string;
  attachments: DraftImageAttachment[];
  settings: GenerationSettings;
  loading: boolean;
  optimizing: boolean;
  onChange: (value: string) => void;
  onAddFiles: (files: File[] | FileList) => void;
  onRemoveFile: (uid: string) => void;
  onSubmit: (value: string) => void;
  onOptimize: (value: string) => void;
  onCancel: () => void;
  onQuickSettingChange: (patch: Partial<GenerationSettings>) => void;
}

export default function Composer({
  value,
  attachments,
  settings,
  loading,
  optimizing,
  onChange,
  onAddFiles,
  onRemoveFile,
  onSubmit,
  onOptimize,
  onCancel,
  onQuickSettingChange,
}: ComposerProps) {
  const [sizeMode, setSizeMode] = useState<PromptEditorSizeMode>("normal");
  const attachmentsRef = useRef<ComponentRef<typeof Attachments>>(null);
  const dropContainerRef = useRef<HTMLDivElement>(null);
  const attachmentItems = useMemo(
    () =>
      attachments.map((attachment) => ({
        uid: attachment.uid,
        name: attachment.name,
        status: "done" as const,
        type: attachment.mimeType,
        size: attachment.size,
        url: attachment.previewUrl,
        thumbUrl: attachment.previewUrl,
        cardType: "image" as const,
        description: formatImageAttachmentBytes(attachment.size),
      })),
    [attachments],
  );
  const totalAttachmentBytes = attachments.reduce((total, item) => total + item.size, 0);
  const promptDirectives = useMemo(() => parsePromptDirectives(value), [value]);
  const optimizationReady = Boolean(
    settings.conversation.enabled &&
    settings.conversation.baseUrl &&
    settings.conversation.apiKey &&
    settings.conversation.model,
  );
  const optimizationDisabledReason = !value.trim()
    ? "请先输入提示词"
    : !optimizationReady
      ? "请先配置并启用 AI 规划连接"
      : undefined;

  return (
    <div {...stylex.props(styles.dock)}>
      <div {...stylex.props(styles.inner)}>
        <div {...stylex.props(styles.composerHeader)}>
          <strong>提示词</strong>
          <span {...stylex.props(styles.composerHeaderActions)}>
            <span {...stylex.props(styles.shortcutHint)}>Enter 发送 · Shift + Enter 换行</span>
            <PromptEditorSizeControl
              value={sizeMode}
              label="提示词输入框"
              onChange={setSizeMode}
            />
          </span>
        </div>
        {promptDirectives.directives.length || promptDirectives.errors.length ? (
          <div {...stylex.props(styles.directiveBar)} aria-live="polite">
            {promptDirectives.errors.length ? (
              <span {...stylex.props(styles.directiveError)}>
                <AlertCircle size={14} aria-hidden="true" />
                {promptDirectives.errors[0]}
              </span>
            ) : (
              <>
                <span {...stylex.props(styles.directiveLabel)}>已识别</span>
                <span {...stylex.props(styles.directiveTags)}>
                  {promptDirectives.directives.map((directive) => (
                    <Tag key={`${directive.key}-${directive.label}`} color="blue">{directive.label}</Tag>
                  ))}
                </span>
                <span {...stylex.props(styles.directiveHint)}>发送时同步到设置</span>
              </>
            )}
          </div>
        ) : null}
        <div ref={dropContainerRef} {...stylex.props(styles.dropContainer)}>
          <Sender
            value={value}
            loading={loading}
            placeholder={
              attachments.length > 0
                ? "描述希望如何参考或修改这些图片"
                : "描述你想生成的画面；Enter 发送，Shift + Enter 换行"
            }
            autoSize={COMPOSER_AUTO_SIZE[sizeMode]}
            onChange={onChange}
            onSubmit={onSubmit}
            onCancel={onCancel}
            onPasteFile={onAddFiles}
            aria-label="提示词输入框"
            styles={sizeMode === "expanded" ? EXPANDED_SENDER_STYLES : undefined}
            className={stylex.props(styles.sender).className}
            header={
              <Sender.Header
                forceRender
                open={attachments.length > 0 && sizeMode !== "compact"}
                closable={false}
                style={sizeMode === "expanded" ? EXPANDED_HEADER_STYLE : undefined}
                title={
                  <span {...stylex.props(styles.attachmentTitle)}>
                    参考图 {attachments.length} / {MAX_IMAGE_ATTACHMENT_COUNT}
                    <small>{formatImageAttachmentBytes(totalAttachmentBytes)}</small>
                  </span>
                }
              >
                <Attachments
                  ref={attachmentsRef}
                  accept={IMAGE_ATTACHMENT_ACCEPT}
                  multiple
                  disabled={loading}
                  maxCount={MAX_IMAGE_ATTACHMENT_COUNT}
                  items={attachmentItems}
                  overflow="scrollX"
                  getDropContainer={() => dropContainerRef.current}
                  beforeUpload={(file) => {
                    onAddFiles([file]);
                    return Upload.LIST_IGNORE;
                  }}
                  onRemove={(file) => {
                    onRemoveFile(file.uid);
                    return true;
                  }}
                  classNames={{
                    card: stylex.props(styles.attachmentCard).className ?? "",
                  }}
                  className={stylex.props(styles.attachments).className}
                />
              </Sender.Header>
            }
            prefix={
              <Tooltip title="添加参考图（支持拖放或粘贴）">
                <Button
                  type="text"
                  size="small"
                  icon={<ImagePlus size={18} />}
                  disabled={loading || attachments.length >= MAX_IMAGE_ATTACHMENT_COUNT}
                  aria-label="添加参考图"
                  className={stylex.props(styles.uploadButton).className}
                  onClick={() =>
                    attachmentsRef.current?.select({
                      accept: IMAGE_ATTACHMENT_ACCEPT,
                      multiple: true,
                    })
                  }
                />
              </Tooltip>
            }
            footer={
              <div {...stylex.props(styles.footer)}>
                <div {...stylex.props(styles.quickSettings)}>
                  <Tooltip title={optimizationDisabledReason || "完善画面细节并安全调整高风险表述"}>
                    <Button
                      type="text"
                      size="small"
                      icon={<WandSparkles size={15} aria-hidden="true" />}
                      loading={optimizing}
                      disabled={loading || optimizing || Boolean(optimizationDisabledReason)}
                      aria-label="优化提示词"
                      {...stylex.props(styles.optimizeButton)}
                      onClick={() => onOptimize(value)}
                    >
                      优化提示词
                    </Button>
                  </Tooltip>
                  <label {...stylex.props(styles.quickSetting)}>
                    <span>生成模式</span>
                    <Select<GenerationMode>
                      size="small"
                      value={settings.mode}
                      aria-label="生成模式"
                      disabled={loading}
                      options={MODE_OPTIONS}
                      popupMatchSelectWidth={150}
                      placement="topLeft"
                      className={stylex.props(styles.modeSelect).className}
                      onChange={(mode) => onQuickSettingChange({ mode })}
                    />
                  </label>
                  <label {...stylex.props(styles.quickSetting)}>
                    <span>画面比例</span>
                    <Select<ImageSize>
                      size="small"
                      value={settings.size}
                      aria-label="画面比例"
                      disabled={loading}
                      options={IMAGE_SIZE_OPTIONS_FOR_SELECT}
                      labelRender={({ value }) => imageSizeLabel(value as ImageSize)}
                      optionRender={(option) => {
                        const sizeOption = option.data as ImageSizeOption;
                        const selected = sizeOption.value === settings.size;

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
                      placement="topLeft"
                      classNames={{
                        content: stylex.props(styles.selectValue).className ?? "",
                        popup: {
                          root: "studio-select-popup studio-ratio-select-popup",
                          listItem: "studio-select-option",
                        },
                      }}
                      className={stylex.props(styles.ratioSelect).className}
                      onChange={(size) => onQuickSettingChange({ size })}
                    />
                  </label>
                  <label {...stylex.props(styles.quickSetting)}>
                    <span>质量</span>
                    <Select<ImageQuality>
                      size="small"
                      value={settings.quality}
                      aria-label="图片质量"
                      disabled={loading}
                      options={QUALITY_OPTIONS}
                      popupMatchSelectWidth={96}
                      placement="topLeft"
                      classNames={{
                        content: stylex.props(styles.selectValue).className ?? "",
                        popup: {
                          root: "studio-select-popup studio-quality-select-popup",
                          listItem: "studio-select-option",
                        },
                      }}
                      className={stylex.props(styles.qualitySelect).className}
                      onChange={(quality) => onQuickSettingChange({ quality })}
                    />
                  </label>
                  <label {...stylex.props(styles.quickSetting)}>
                    <span>{settings.mode === "storyboard" ? "分镜数量" : "生成数量"}</span>
                    <Select<number>
                      size="small"
                      virtual={false}
                      value={settings.mode === "storyboard"
                        ? (settings.storyboardQuantity === "auto" ? 0 : settings.storyboardQuantity)
                        : settings.quantity}
                      aria-label="生成数量"
                      disabled={loading}
                      options={settings.mode === "storyboard" ? STORYBOARD_QUANTITY_OPTIONS : QUANTITY_OPTIONS}
                      popupMatchSelectWidth={108}
                      placement="topLeft"
                      classNames={{
                        content: stylex.props(styles.selectValue).className ?? "",
                        popup: {
                          root: "studio-select-popup studio-quantity-select-popup",
                          listItem: "studio-select-option",
                        },
                      }}
                      className={stylex.props(styles.quantitySelect).className}
                      onChange={(quantity) => onQuickSettingChange(
                        settings.mode === "storyboard"
                          ? { storyboardQuantity: quantity === 0 ? "auto" : quantity }
                          : { quantity },
                      )}
                    />
                  </label>
                </div>
                <span {...stylex.props(styles.hint)}>
                  {value.length.toLocaleString()} / 20,000
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

const QUALITY_OPTIONS = [
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
] satisfies { label: string; value: ImageQuality }[];

const IMAGE_SIZE_OPTIONS_FOR_SELECT = IMAGE_SIZE_OPTIONS.map((option) => ({ ...option }));

const QUANTITY_OPTIONS = Array.from({ length: 9 }, (_, index) => ({
  label: `${index + 1} 张`,
  value: index + 1,
}));

const STORYBOARD_QUANTITY_OPTIONS = [
  { label: "自动", value: 0 },
  ...[3, 4, 6, 9].map((value) => ({ label: `${value} 镜头`, value })),
];

const MODE_OPTIONS = [
  { label: "单图", value: "direct" },
  { label: "多变体", value: "variations" },
  { label: "分镜", value: "storyboard" },
] satisfies { label: string; value: GenerationMode }[];

const COMPOSER_AUTO_SIZE: Record<PromptEditorSizeMode, false | { minRows: number; maxRows: number }> = {
  compact: { minRows: 1, maxRows: 2 },
  normal: { minRows: 2, maxRows: 6 },
  expanded: false,
};

const EXPANDED_SENDER_STYLES = {
  root: {
    height: "clamp(240px, 70dvh, 680px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } satisfies CSSProperties,
  content: {
    minHeight: 0,
    flex: "1 1 auto",
  } satisfies CSSProperties,
  input: {
    height: "100%",
    maxHeight: "none",
    overflowY: "auto",
    resize: "none",
  } satisfies CSSProperties,
  footer: {
    flex: "0 0 auto",
  } satisfies CSSProperties,
};

const EXPANDED_HEADER_STYLE = { flex: "0 0 auto" } satisfies CSSProperties;

const styles = stylex.create({
  dock: {
    minWidth: 0,
    padding: "14px 24px 18px",
    "@media (max-width: 767px)": {
      padding: "12px 10px 10px",
    },
  },
  inner: {
    width: "min(1200px, 100%)",
    margin: "0 auto",
  },
  composerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "0 8px 8px",
    color: colors.muted,
    fontSize: "12px",
  },
  composerHeaderActions: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
  },
  shortcutHint: {
    whiteSpace: "nowrap",
    "@media (max-width: 620px)": {
      display: "none",
    },
  },
  directiveBar: {
    minHeight: "30px",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "7px",
    margin: "0 6px 8px",
    padding: "5px 8px",
    color: colors.body,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
    fontSize: "12px",
  },
  directiveLabel: { color: colors.primary, fontWeight: 600 },
  directiveTags: { display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "2px" },
  directiveHint: { color: colors.subtle },
  directiveError: { display: "inline-flex", alignItems: "center", gap: "6px", color: colors.danger },
  dropContainer: {
    position: "relative",
  },
  sender: {
    borderColor: colors.glassBorder,
    borderRadius: radii.xlarge,
    boxShadow: shadows.glass,
    backgroundColor: colors.glassSubtle,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
    transitionProperty: "border-color, box-shadow",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      borderColor: colors.primary,
    },
    ":focus-within": {
      borderColor: colors.primary,
      boxShadow: shadows.focus,
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
    },
  },
  attachmentTitle: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    color: colors.ink,
    fontSize: "13px",
  },
  attachments: {
    paddingBottom: "2px",
  },
  attachmentCard: {
    transitionProperty: "transform, box-shadow, border-color",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      borderColor: colors.primary,
      boxShadow: shadows.subtle,
      transform: "translateY(-1px)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  uploadButton: {
    width: "44px",
    minWidth: "44px",
    height: "44px",
    color: colors.muted,
    borderRadius: radii.medium,
    transitionProperty: "color, background-color, transform, box-shadow",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    ":active": {
      color: colors.primaryPressed,
      backgroundColor: colors.primarySoftHover,
      transform: "scale(0.94)",
    },
    ":focus-visible": {
      boxShadow: shadows.focus,
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  footer: {
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    paddingTop: "4px",
  },
  quickSettings: {
    minWidth: 0,
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  optimizeButton: {
    minHeight: "32px",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.medium,
    fontWeight: 600,
    ":hover": { color: colors.primaryHover, backgroundColor: colors.primarySoftHover },
    ":focus-visible": { boxShadow: shadows.focus },
  },
  quickSetting: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: colors.muted,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  ratioSelect: {
    width: "168px",
    "@media (max-width: 520px)": {
      width: "152px",
    },
  },
  qualitySelect: {
    width: "76px",
  },
  modeSelect: {
    width: "92px",
  },
  quantitySelect: {
    width: "96px",
  },
  selectValue: {
    color: colors.ink,
    fontWeight: 600,
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
  hint: {
    marginLeft: "auto",
    flexShrink: 0,
    whiteSpace: "nowrap",
    color: colors.subtle,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
  },
});
