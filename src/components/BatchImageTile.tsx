import type { CSSProperties, ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { Spin } from "antd";
import {
  AlertCircle,
  AlertTriangle,
  Image as ImageIcon,
  OctagonX,
} from "lucide-react";

import type { ImageActionSource } from "../lib/image-actions";
import { formatImageAspectRatio } from "../lib/image-aspect";
import { imageAspectRatio, imageSizeLabel } from "../lib/image-sizes";
import type { AssistantMessage } from "../types";
import { colors, motion, radii } from "../styles/tokens.stylex";
import ImageResultCard from "./ImageResultCard";

interface BatchImageTileProps {
  message: AssistantMessage;
  index: number;
  total: number;
  actions: ReactNode;
  onCopyImage: (source: ImageActionSource) => void | Promise<void>;
  onDownloadImage: (source: ImageActionSource) => void | Promise<void>;
  onImageSourceReady: (source: ImageActionSource) => void;
}

export default function BatchImageTile({
  message,
  index,
  total,
  actions,
  onCopyImage,
  onDownloadImage,
  onImageSourceReady,
}: BatchImageTileProps) {
  const state = resultState(message);
  const mismatchDetail = aspectMismatchDetail(message);

  return (
    <article
      {...stylex.props(styles.root)}
      aria-label={`批量结果，第 ${index + 1} 张，共 ${total} 张，${state.label}`}
    >
      {message.status === "success" ? (
        <ImageResultCard
          message={message}
          variant="batch"
          onCopyImage={onCopyImage}
          onDownloadImage={onDownloadImage}
          onImageSourceReady={onImageSourceReady}
        />
      ) : (
        <div
          {...stylex.props(
            styles.stateCanvas,
            state.kind === "error" && styles.errorCanvas,
            state.kind === "aborted" && styles.abortedCanvas,
          )}
          style={stageStyle(message)}
          role={state.kind === "error" ? "alert" : "status"}
        >
          <span {...stylex.props(styles.stateIcon)}>
            {state.kind === "loading" ? (
              <ImageIcon size={24} aria-hidden="true" />
            ) : state.kind === "aborted" ? (
              <OctagonX size={24} aria-hidden="true" />
            ) : (
              <AlertCircle size={24} aria-hidden="true" />
            )}
          </span>
          <div {...stylex.props(styles.stateCopy)}>
            <strong>{state.label}</strong>
            {state.detail ? <span>{state.detail}</span> : null}
          </div>
          {state.kind === "loading" ? <Spin size="small" /> : null}
        </div>
      )}

      {mismatchDetail ? (
        <div {...stylex.props(styles.aspectWarning)} role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{mismatchDetail}</span>
        </div>
      ) : null}

      <div {...stylex.props(styles.actions)}>{actions}</div>
    </article>
  );
}

function resultState(message: AssistantMessage): {
  kind: "loading" | "error" | "aborted" | "success";
  label: string;
  detail?: string;
} {
  if (message.status === "loading") {
    return message.aspectStatus === "retrying"
      ? {
          kind: "loading",
          label: "正在按比例重试",
          detail: "正在串行重新生成，以匹配所选画布比例。",
        }
      : { kind: "loading", label: "正在生成" };
  }

  if (message.status === "aborted") {
    return { kind: "aborted", label: "已停止生成", detail: "请求已由你停止。" };
  }

  if (message.status === "error") {
    return { kind: "error", label: "生成失败", detail: message.error };
  }

  if (message.aspectStatus === "mismatched") {
    return {
      kind: "success",
      label: "比例未匹配",
      detail: aspectMismatchDetail(message),
    };
  }

  return { kind: "success", label: "生成完成" };
}

function aspectMismatchDetail(message: AssistantMessage): string | undefined {
  if (message.aspectStatus !== "mismatched") {
    return undefined;
  }

  const actualRatio =
    message.actualWidth && message.actualHeight
      ? `实际 ${formatImageAspectRatio(message.actualWidth, message.actualHeight)}（${message.actualWidth} x ${message.actualHeight}）`
      : "实际比例未匹配";
  const recovery = message.aspectRetried
    ? "已尝试自动重试，保留原图。"
    : "已保留原图。";

  return `${actualRatio}，未符合 ${imageSizeLabel(message.request.size)}。${recovery}`;
}

function stageStyle(message: AssistantMessage): CSSProperties {
  return {
    "--batch-image-aspect-ratio": imageAspectRatio(message.request.size),
  } as CSSProperties;
}

const pulse = stylex.keyframes({
  "0%, 100%": { opacity: 0.5 },
  "50%": { opacity: 1 },
});

const styles = stylex.create({
  root: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  stateCanvas: {
    width: "100%",
    aspectRatio: "var(--batch-image-aspect-ratio)",
    minHeight: 0,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "12px",
    padding: "20px",
    boxSizing: "border-box",
    color: colors.onDarkMuted,
    textAlign: "center",
    backgroundColor: colors.dark,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
  },
  errorCanvas: {
    color: colors.dangerOnDark,
    backgroundColor: colors.dangerOnDarkSoft,
    borderColor: colors.danger,
  },
  abortedCanvas: {
    color: colors.muted,
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
  },
  stateIcon: {
    display: "grid",
    placeItems: "center",
    animationName: pulse,
    animationDuration: "1.4s",
    animationIterationCount: "infinite",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  stateCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxWidth: "100%",
    fontSize: "13px",
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  aspectWarning: {
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    gap: "7px",
    padding: "8px 10px",
    color: colors.warning,
    fontSize: "12px",
    lineHeight: 1.45,
    backgroundColor: colors.warningSoft,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.warning,
    borderRadius: radii.small,
    overflowWrap: "anywhere",
  },
  actions: {
    minHeight: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
});
