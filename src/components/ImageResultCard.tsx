import { useEffect, useState, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button, Image, Modal, Spin } from "antd";
import { AlertCircle, AlertTriangle, Columns2 } from "lucide-react";

import {
  imagePreviewSizing,
  imagePreviewSizingFromDimensions,
  imageSizeLabel,
} from "../lib/image-sizes";
import {
  generatedImageFileName,
  type ImageActionSource,
} from "../lib/image-actions";
import {
  imageActualDimensionLabel,
  imageDimensionMismatchMessage,
} from "../lib/image-aspect";
import { qualityLabel } from "../lib/generation-plan";
import useResolvedGeneratedImage from "../hooks/useResolvedGeneratedImage";
import type { ImageRetryState } from "../hooks/useImageRegeneration";
import type { AssistantMessage, GeneratedImageVersion } from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";
import ImageContextMenu from "./ImageContextMenu";

interface ImageResultCardProps {
  message: AssistantMessage;
  onCopyImage: (source: ImageActionSource) => void | Promise<void>;
  onDownloadImage: (source: ImageActionSource) => void | Promise<void>;
  onImageSourceReady: (source: ImageActionSource) => void;
  onChooseComparison: (
    message: AssistantMessage,
    choice: "previous" | "candidate",
  ) => void;
  retryState?: ImageRetryState;
  variant?: "default" | "batch";
}

export default function ImageResultCard({
  message,
  onCopyImage,
  onDownloadImage,
  onImageSourceReady,
  onChooseComparison,
  retryState,
  variant = "default",
}: ImageResultCardProps) {
  const isBatchPresentation = variant === "batch";
  const Container = isBatchPresentation ? "div" : "article";
  const candidate = message.comparison?.candidate;
  const [comparisonView, setComparisonView] = useState<"previous" | "candidate">(
    candidate ? "candidate" : "previous",
  );
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const previousResolved = useResolvedGeneratedImage(message);
  const candidateResolved = useResolvedGeneratedImage(candidate);
  const viewingCandidate = Boolean(candidate && comparisonView === "candidate");
  const activeVersion: AssistantMessage | GeneratedImageVersion = viewingCandidate
    ? candidate!
    : message;
  const activeResolved = viewingCandidate ? candidateResolved : previousResolved;
  const resolvedImage = activeResolved.image;
  const imageUrl = resolvedImage?.url ?? null;
  const loadFailed = activeResolved.failed;
  const [previewSizing, setPreviewSizing] = useState(() =>
    imagePreviewSizing(message.request.size),
  );
  const actualDimensionLabel = imageActualDimensionLabel(
    message.request.size,
    activeVersion.aspectStatus,
    activeVersion.actualWidth,
    activeVersion.actualHeight,
  );

  useEffect(() => {
    setComparisonView(candidate ? "candidate" : "previous");
  }, [candidate?.id]);

  useEffect(() => {
    if (!resolvedImage) {
      return;
    }

    onImageSourceReady({
      url: resolvedImage.url,
      fileName: generatedImageFileName(activeVersion.createdAt, activeVersion.mimeType),
      mimeType: activeVersion.mimeType,
      blob: resolvedImage.blob,
    });
  }, [activeVersion.createdAt, activeVersion.mimeType, onImageSourceReady, resolvedImage]);

  return (
    <Container {...stylex.props(styles.card)} aria-label="生成的图片">
      {imageUrl ? (
        <ImageContextMenu
          source={{
            url: imageUrl,
            fileName: generatedImageFileName(activeVersion.createdAt, activeVersion.mimeType),
            mimeType: activeVersion.mimeType,
            blob: resolvedImage?.blob,
          }}
          onCopy={onCopyImage}
          onDownload={onDownloadImage}
        >
          <div
            {...stylex.props(
              styles.imageFrame,
              isBatchPresentation && styles.batchImageFrame,
            )}
            style={previewSizingStyle(previewSizing)}
          >
            <Image
              src={imageUrl}
              alt="生成结果图片"
              preview={{ mask: "查看大图" }}
              width="100%"
              loading="lazy"
              wrapperStyle={
                isBatchPresentation
                  ? { width: "100%", height: "100%", display: "block" }
                  : undefined
              }
              style={
                isBatchPresentation
                  ? { width: "100%", height: "100%", objectFit: "contain" }
                  : undefined
              }
              className={stylex.props(styles.image).className}
              onLoad={(event) => {
                if (isBatchPresentation) {
                  return;
                }

                const nextSizing = imagePreviewSizingFromDimensions(
                  event.currentTarget.naturalWidth,
                  event.currentTarget.naturalHeight,
                );
                setPreviewSizing(nextSizing);
              }}
            />
            {retryState?.status === "retrying" ? (
              <div {...stylex.props(styles.retryOverlay)} role="status">
                <Spin size="small" />
                <strong>正在按原设置重试</strong>
                <span>当前仍显示上一版，生成完成后可进行二选一。</span>
              </div>
            ) : null}
          </div>
        </ImageContextMenu>
      ) : (
        <div
          {...stylex.props(
            styles.imageFrame,
            isBatchPresentation && styles.batchImageFrame,
          )}
          style={previewSizingStyle(previewSizing)}
        >
          <div
            {...stylex.props(styles.imagePlaceholder, loadFailed && styles.imageError)}
            role={loadFailed ? "alert" : "status"}
          >
            {loadFailed ? <AlertCircle size={24} aria-hidden="true" /> : <Spin />}
            <span>{loadFailed ? "无法读取本地图片" : "正在读取本地图片..."}</span>
          </div>
        </div>
      )}

      {candidate ? (
        <div {...stylex.props(styles.comparisonPanel)} role="status">
          <div {...stylex.props(styles.comparisonHeader)}>
            <div {...stylex.props(styles.versionSwitch)} role="tablist" aria-label="图片版本">
              <Button
                size="small"
                className={stylex.props(styles.comparisonButton).className}
                type={comparisonView === "previous" ? "primary" : "default"}
                role="tab"
                aria-selected={comparisonView === "previous"}
                onClick={() => setComparisonView("previous")}
              >
                上一版
              </Button>
              <Button
                size="small"
                className={stylex.props(styles.comparisonButton).className}
                type={comparisonView === "candidate" ? "primary" : "default"}
                role="tab"
                aria-selected={comparisonView === "candidate"}
                onClick={() => setComparisonView("candidate")}
              >
                新版本
              </Button>
            </div>
            <Button
              size="small"
              className={stylex.props(styles.comparisonButton).className}
              icon={<Columns2 size={15} aria-hidden="true" />}
              onClick={() => setComparisonOpen(true)}
            >
              并排对比
            </Button>
          </div>
          <div {...stylex.props(styles.comparisonMeta)}>
            <span>{`上一版：${versionDimensionLabel(message)}`}</span>
            <span>{`新版本：${versionDimensionLabel(candidate)}`}</span>
          </div>
          <div {...stylex.props(styles.comparisonActions)}>
            <Button
              className={stylex.props(styles.comparisonButton).className}
              onClick={() => onChooseComparison(message, "previous")}
            >
              保留上一版
            </Button>
            <Button
              type="primary"
              className={stylex.props(styles.comparisonButton).className}
              onClick={() => onChooseComparison(message, "candidate")}
            >
              采用新版本
            </Button>
          </div>
          <span {...stylex.props(styles.comparisonHint)}>
            完成选择后只保留其中一张，之后才能再次重试。
          </span>
        </div>
      ) : null}

      {retryState && retryState.status !== "retrying" ? (
        <div {...stylex.props(styles.retryNotice)} role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{retryState.detail}</span>
        </div>
      ) : null}

      {isBatchPresentation && actualDimensionLabel ? (
        <div {...stylex.props(styles.batchOutputMeta)}>{actualDimensionLabel}</div>
      ) : null}

      {!isBatchPresentation && activeVersion.aspectStatus === "mismatched" ? (
        <div {...stylex.props(styles.aspectWarning)} role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {imageDimensionMismatchMessage(
              message.request.size,
              activeVersion.actualWidth,
              activeVersion.actualHeight,
            )} 已保留这张图片；如需再试，请点击“按原设置重试此张”，这会发起一次新的生成请求。
          </span>
        </div>
      ) : null}

      {!isBatchPresentation ? (
        <div {...stylex.props(styles.meta)}>
          <div {...stylex.props(styles.chips)}>
            <span>{message.request.model}</span>
            <span>{imageSizeLabel(message.request.size)}</span>
            <span>{qualityLabel(message.request.quality)}</span>
            {actualDimensionLabel ? <span>{actualDimensionLabel}</span> : null}
          </div>

          {activeVersion.revisedPrompt ? (
            <details {...stylex.props(styles.details)}>
              <summary>查看修订后的提示词</summary>
              <p>{activeVersion.revisedPrompt}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={comparisonOpen && Boolean(candidate)}
        title="比较上一版与新版本"
        width={1080}
        centered
        destroyOnHidden
        onCancel={() => setComparisonOpen(false)}
        footer={
          <div {...stylex.props(styles.modalFooter)}>
            <Button
              className={stylex.props(styles.comparisonButton).className}
              onClick={() => {
                setComparisonOpen(false);
                onChooseComparison(message, "previous");
              }}
            >
              保留上一版
            </Button>
            <Button
              type="primary"
              className={stylex.props(styles.comparisonButton).className}
              onClick={() => {
                setComparisonOpen(false);
                onChooseComparison(message, "candidate");
              }}
            >
              采用新版本
            </Button>
          </div>
        }
      >
        <div
          {...stylex.props(styles.modalVersionSwitch)}
          role="tablist"
          aria-label="对比图片版本"
        >
          <Button
            type={comparisonView === "previous" ? "primary" : "default"}
            className={stylex.props(styles.comparisonButton).className}
            role="tab"
            aria-selected={comparisonView === "previous"}
            onClick={() => setComparisonView("previous")}
          >
            上一版
          </Button>
          <Button
            type={comparisonView === "candidate" ? "primary" : "default"}
            className={stylex.props(styles.comparisonButton).className}
            role="tab"
            aria-selected={comparisonView === "candidate"}
            onClick={() => setComparisonView("candidate")}
          >
            新版本
          </Button>
        </div>
        <div {...stylex.props(styles.compareGrid)}>
          <ComparisonPane
            label="上一版"
            imageUrl={previousResolved.image?.url}
            failed={previousResolved.failed}
            detail={versionDimensionLabel(message)}
            hiddenOnMobile={comparisonView !== "previous"}
          />
          <ComparisonPane
            label="新版本"
            imageUrl={candidateResolved.image?.url}
            failed={candidateResolved.failed}
            detail={candidate ? versionDimensionLabel(candidate) : ""}
            hiddenOnMobile={comparisonView !== "candidate"}
          />
        </div>
      </Modal>
    </Container>
  );
}

function ComparisonPane({
  label,
  imageUrl,
  failed,
  detail,
  hiddenOnMobile,
}: {
  label: string;
  imageUrl?: string;
  failed: boolean;
  detail: string;
  hiddenOnMobile: boolean;
}) {
  return (
    <section
      {...stylex.props(
        styles.comparePane,
        hiddenOnMobile && styles.comparePaneHiddenMobile,
      )}
      aria-label={label}
    >
      <div {...stylex.props(styles.comparePaneHeader)}>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <div {...stylex.props(styles.compareCanvas)}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${label}图片`}
            preview={false}
            width="100%"
            className={stylex.props(styles.compareImage).className}
          />
        ) : failed ? (
          <span>无法读取这个版本</span>
        ) : (
          <Spin />
        )}
      </div>
    </section>
  );
}

function versionDimensionLabel(
  version: Pick<GeneratedImageVersion, "actualWidth" | "actualHeight" | "aspectStatus">,
): string {
  const dimensions = version.actualWidth && version.actualHeight
    ? `${version.actualWidth} × ${version.actualHeight}`
    : "尺寸待确认";
  return version.aspectStatus === "mismatched" ? `${dimensions} · 比例不符` : dimensions;
}

function previewSizingStyle(sizing: ReturnType<typeof imagePreviewSizing>): CSSProperties {
  return {
    "--preview-desktop-width": `${sizing.desktopWidth}px`,
    "--preview-mobile-width": `${sizing.mobileWidth}px`,
    "--preview-aspect-ratio": sizing.aspectRatio,
  } as CSSProperties;
}

const styles = stylex.create({
  card: {
    width: "100%",
    maxWidth: "100%",
  },
  imageFrame: {
    position: "relative",
    width: "var(--preview-desktop-width)",
    maxWidth: "100%",
    display: "block",
    overflow: "hidden",
    lineHeight: 0,
    backgroundColor: colors.surface,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
    cursor: "zoom-in",
    transitionProperty: "border-color, box-shadow, transform",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      borderColor: colors.primary,
      boxShadow: shadows.interactive,
      transform: "translateY(-1px)",
    },
    ":active": {
      transform: "scale(0.995)",
    },
    "@media (max-width: 767px)": {
      width: "var(--preview-mobile-width)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  batchImageFrame: {
    width: "100%",
    aspectRatio: "var(--preview-aspect-ratio)",
    display: "grid",
    placeItems: "center",
  },
  image: {
    width: "100%",
    height: "auto",
    display: "block",
    transitionProperty: "transform",
    transitionDuration: motion.slow,
    transitionTimingFunction: motion.easing,
    ":hover": {
      transform: "scale(1.012)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: "var(--preview-aspect-ratio)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "10px",
    color: colors.onDarkMuted,
    fontSize: "13px",
    lineHeight: 1.5,
    backgroundColor: colors.dark,
  },
  imageError: {
    color: colors.dangerOnDark,
  },
  meta: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    paddingTop: "14px",
  },
  aspectWarning: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginTop: "12px",
    padding: "10px 12px",
    color: colors.warning,
    fontSize: "13px",
    lineHeight: 1.5,
    backgroundColor: colors.warningSoft,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.warning,
    borderRadius: radii.medium,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    color: colors.muted,
    fontSize: "12px",
  },
  batchOutputMeta: {
    paddingTop: "6px",
    color: colors.subtle,
    fontSize: "11px",
    lineHeight: 1.4,
    fontVariantNumeric: "tabular-nums",
  },
  details: {
    color: colors.body,
    fontSize: "13px",
    lineHeight: 1.6,
    cursor: "pointer",
  },
  retryOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "8px",
    padding: "20px",
    color: colors.onDark,
    fontSize: "13px",
    lineHeight: 1.5,
    textAlign: "center",
    backgroundColor: "rgb(6 12 20 / 76%)",
    backdropFilter: "blur(4px)",
    pointerEvents: "none",
  },
  comparisonPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "10px",
    padding: "12px",
    color: colors.body,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  comparisonButton: {
    "@media (pointer: coarse)": {
      minHeight: "44px",
    },
  },
  comparisonHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "8px",
  },
  versionSwitch: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  comparisonMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 14px",
    color: colors.muted,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
  },
  comparisonActions: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: "8px",
  },
  comparisonHint: {
    color: colors.subtle,
    fontSize: "12px",
    lineHeight: 1.5,
  },
  retryNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginTop: "10px",
    padding: "9px 11px",
    color: colors.warning,
    fontSize: "12px",
    lineHeight: 1.5,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.medium,
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    "@media (max-width: 767px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  modalVersionSwitch: {
    display: "none",
    gap: "8px",
    marginBottom: "12px",
    "@media (max-width: 767px)": {
      display: "flex",
    },
  },
  comparePane: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  comparePaneHiddenMobile: {
    "@media (max-width: 767px)": {
      display: "none",
    },
  },
  comparePaneHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "6px",
    color: colors.body,
    fontSize: "13px",
  },
  compareCanvas: {
    minHeight: "220px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    color: colors.muted,
    backgroundColor: colors.dark,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  compareImage: {
    width: "100%",
    maxHeight: "min(62vh, 720px)",
    objectFit: "contain",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: "8px",
  },
});
