import { useMemo, useRef, useState, type ComponentRef, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Attachments, Sender } from "@ant-design/x";
import { Button, Tooltip, Upload } from "antd";
import { ImagePlus, WandSparkles } from "lucide-react";

import {
  formatImageAttachmentBytes,
  IMAGE_ATTACHMENT_ACCEPT,
  MAX_IMAGE_ATTACHMENT_COUNT,
} from "../lib/image-attachments";
import { parsePromptDirectives } from "../lib/prompt-directives";
import GenerationControls from "./GenerationControls";
import PromptEditorSizeControl, {
  type PromptEditorSizeMode,
} from "./PromptEditorSizeControl";
import type { DraftImageAttachment, GenerationSettings } from "../types";
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
  const submissionError = promptDirectives.errors[0];
  const optimizationConnected = Boolean(
    settings.conversation.baseUrl &&
    settings.conversation.apiKey &&
    settings.conversation.model,
  );
  const optimizationDisabledReason = !value.trim()
    ? "请先输入提示词"
    : undefined;
  const optimizationHint = !optimizationConnected
    ? "AI 辅助连接尚未配置完整；点击后可前往连接设置"
    : "完善画面细节并安全调整高风险表述";

  return (
    <div {...stylex.props(styles.dock)}>
      <div {...stylex.props(styles.inner)}>
        <div {...stylex.props(styles.composerHeader)}>
          <strong>提示词</strong>
          <span {...stylex.props(styles.composerHeaderActions)}>
            <span {...stylex.props(styles.shortcutHint)}>Enter 发送 · Shift + Enter 换行</span>
            <Tooltip title={optimizationDisabledReason || optimizationHint}>
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
            <PromptEditorSizeControl
              value={sizeMode}
              label="提示词输入框"
              onChange={setSizeMode}
            />
          </span>
        </div>
        <div
          ref={dropContainerRef}
          data-composer-container=""
          {...stylex.props(styles.dropContainer)}
        >
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
            onSubmit={(prompt) => {
              if (!submissionError) onSubmit(prompt);
            }}
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
            suffix={(originalNode, { components: { SendButton } }) =>
              submissionError ? (
                <Tooltip title={submissionError}>
                  <SendButton
                    size="large"
                    disabled
                    aria-label={`无法发送：${submissionError}`}
                    className="studio-composer-send"
                  />
                </Tooltip>
              ) : originalNode
            }
            footer={
              <div {...stylex.props(styles.footer)}>
                <GenerationControls
                  settings={settings}
                  directives={promptDirectives}
                  disabled={loading}
                  characterCount={`${value.length.toLocaleString()} / 20,000`}
                  onChange={onQuickSettingChange}
                />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

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
    padding: "10px 24px 12px",
    "@media (max-width: 767px)": {
      padding: "8px 10px",
    },
  },
  inner: {
    width: "min(1200px, 100%)",
    margin: "0 auto",
  },
  composerHeader: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "clamp(6px, 1.2vw, 12px)",
    padding: "0 4px 6px",
    color: colors.muted,
    fontSize: "12px",
  },
  composerHeaderActions: {
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "clamp(4px, 1vw, 10px)",
  },
  shortcutHint: {
    whiteSpace: "nowrap",
    "@media (max-width: 860px)": {
      display: "none",
    },
  },
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
    minWidth: 0,
    width: "100%",
    paddingTop: "2px",
  },
  optimizeButton: {
    minHeight: "34px",
    paddingInline: "clamp(7px, 1vw, 11px)",
    whiteSpace: "nowrap",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.medium,
    fontSize: "12px",
    fontWeight: 600,
    ":hover": { color: colors.primaryHover, backgroundColor: colors.primarySoftHover },
    ":focus-visible": { boxShadow: shadows.focus },
    "@media (pointer: coarse)": {
      minHeight: "44px",
    },
  },
});
