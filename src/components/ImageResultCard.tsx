import { useEffect, useState, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Image, Spin } from "antd";
import { AlertCircle } from "lucide-react";

import {
  imagePreviewSizing,
  imagePreviewSizingFromDimensions,
  imageSizeLabel,
} from "../lib/image-sizes";
import { loadGeneratedImage } from "../lib/studio-db";
import type { AssistantMessage } from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";

interface ImageResultCardProps {
  message: AssistantMessage;
}

export default function ImageResultCard({ message }: ImageResultCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(message.imageDataUrl ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [previewSizing, setPreviewSizing] = useState(() =>
    imagePreviewSizing(message.request.size),
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

  return (
    <article {...stylex.props(styles.card)} aria-label="生成的图片">
      <div
        {...stylex.props(styles.imageFrame)}
        style={previewSizingStyle(previewSizing)}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`根据提示词生成的图片：${message.prompt}`}
            preview={{ mask: "查看大图" }}
            width="100%"
            loading="lazy"
            className={stylex.props(styles.image).className}
            onLoad={(event) => {
              const nextSizing = imagePreviewSizingFromDimensions(
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              );
              setPreviewSizing(nextSizing);
            }}
          />
        ) : (
          <div
            {...stylex.props(styles.imagePlaceholder, loadFailed && styles.imageError)}
            role={loadFailed ? "alert" : "status"}
          >
            {loadFailed ? <AlertCircle size={24} aria-hidden="true" /> : <Spin />}
            <span>{loadFailed ? "无法读取本地图片" : "正在读取本地图片..."}</span>
          </div>
        )}
      </div>

      <div {...stylex.props(styles.meta)}>
        <div {...stylex.props(styles.chips)}>
          <span>{message.request.model}</span>
          <span>{imageSizeLabel(message.request.size)}</span>
          <span>{qualityLabel(message.request.quality)}</span>
        </div>

        {message.revisedPrompt ? (
          <details {...stylex.props(styles.details)}>
            <summary>查看修订后的提示词</summary>
            <p>{message.revisedPrompt}</p>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function qualityLabel(quality: AssistantMessage["request"]["quality"]): string {
  return { low: "低质量", medium: "中质量", high: "高质量" }[quality];
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
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    color: colors.muted,
    fontSize: "12px",
  },
  details: {
    color: colors.body,
    fontSize: "13px",
    lineHeight: 1.6,
    cursor: "pointer",
  },
});
