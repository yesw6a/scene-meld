import { useEffect, useState, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Image, Spin } from "antd";
import { AlertCircle, AlertTriangle } from "lucide-react";

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
import { loadGeneratedImage } from "../lib/studio-db";
import type { AssistantMessage } from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";
import ImageContextMenu from "./ImageContextMenu";

interface ImageResultCardProps {
  message: AssistantMessage;
  onCopyImage: (source: ImageActionSource) => void | Promise<void>;
  onDownloadImage: (source: ImageActionSource) => void | Promise<void>;
  onImageSourceReady: (source: ImageActionSource) => void;
  variant?: "default" | "batch";
}

export default function ImageResultCard({
  message,
  onCopyImage,
  onDownloadImage,
  onImageSourceReady,
  variant = "default",
}: ImageResultCardProps) {
  const isBatchPresentation = variant === "batch";
  const Container = isBatchPresentation ? "div" : "article";
  const [imageUrl, setImageUrl] = useState<string | null>(message.imageDataUrl ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [previewSizing, setPreviewSizing] = useState(() =>
    imagePreviewSizing(message.request.size),
  );
  const actualDimensionLabel = imageActualDimensionLabel(
    message.request.size,
    message.aspectStatus,
    message.actualWidth,
    message.actualHeight,
  );

  useEffect(() => {
    if (message.imageDataUrl) {
      setImageUrl(message.imageDataUrl);
      setLoadFailed(false);
      return;
    }

    if (!message.imageId) {
      setImageUrl(null);
      setLoadFailed(true);
      return;
    }

    let active = true;
    let objectUrl: string | undefined;
    setImageUrl(null);
    setLoadFailed(false);

    void loadGeneratedImage(message.imageId)
      .then((blob) => {
        if (!blob) {
          throw new Error("missing image");
        }

        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setImageUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [message.imageDataUrl, message.imageId]);

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    onImageSourceReady({
      url: imageUrl,
      fileName: generatedImageFileName(message.createdAt, message.mimeType),
      mimeType: message.mimeType,
    });
  }, [imageUrl, message.createdAt, message.mimeType, onImageSourceReady]);

  return (
    <Container {...stylex.props(styles.card)} aria-label="生成的图片">
      {imageUrl ? (
        <ImageContextMenu
          source={{
            url: imageUrl,
            fileName: generatedImageFileName(message.createdAt, message.mimeType),
            mimeType: message.mimeType,
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

      {isBatchPresentation && actualDimensionLabel ? (
        <div {...stylex.props(styles.batchOutputMeta)}>{actualDimensionLabel}</div>
      ) : null}

      {!isBatchPresentation && message.aspectStatus === "mismatched" ? (
        <div {...stylex.props(styles.aspectWarning)} role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {imageDimensionMismatchMessage(
              message.request.size,
              message.actualWidth,
              message.actualHeight,
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

          {message.revisedPrompt ? (
            <details {...stylex.props(styles.details)}>
              <summary>查看修订后的提示词</summary>
              <p>{message.revisedPrompt}</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </Container>
  );
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
});
