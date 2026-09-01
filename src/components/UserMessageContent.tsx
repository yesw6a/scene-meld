import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Image } from "antd";
import { ImageOff } from "lucide-react";

import { formatImageAttachmentBytes } from "../lib/image-attachments";
import type { ImageActionSource } from "../lib/image-actions";
import { loadGeneratedImage } from "../lib/studio-db";
import type { MessageImageAttachment, UserMessage } from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";
import ImageContextMenu from "./ImageContextMenu";

interface ResolvedAttachment {
  attachment: MessageImageAttachment;
  url: string | null;
  blob: Blob | null;
}

interface UserMessageContentProps {
  message: UserMessage;
  onCopyImage: (source: ImageActionSource) => void | Promise<void>;
  onDownloadImage: (source: ImageActionSource) => void | Promise<void>;
  onImageSourceReady: (source: ImageActionSource) => void;
}

export default function UserMessageContent({
  message,
  onCopyImage,
  onDownloadImage,
  onImageSourceReady,
}: UserMessageContentProps) {
  const [resolved, setResolved] = useState<ResolvedAttachment[]>(() =>
    (message.attachments ?? []).map((attachment) => ({
      attachment,
      url: null,
      blob: null,
    })),
  );

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    void Promise.all(
      (message.attachments ?? []).map(async (attachment) => {
        const blob = attachment.blob ?? (await loadGeneratedImage(attachment.id));
        if (!blob) {
          return { attachment, url: null, blob: null };
        }

        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        return { attachment, url, blob };
      }),
    ).then((items) => {
      if (active) {
        setResolved(items);
      } else {
        for (const url of objectUrls) {
          URL.revokeObjectURL(url);
        }
      }
    });

    return () => {
      active = false;
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [message.attachments]);

  useEffect(() => {
    for (const { attachment, url, blob } of resolved) {
      if (!url || !blob) {
        continue;
      }

      onImageSourceReady({
        url,
        fileName: attachment.name,
        mimeType: attachment.mimeType,
        blob,
      });
    }
  }, [onImageSourceReady, resolved]);

  return (
    <div {...stylex.props(styles.content)}>
      {resolved.length > 0 ? (
        <div {...stylex.props(styles.attachments)} aria-label="参考图片">
          {resolved.map(({ attachment, url, blob }) => (
            <figure key={attachment.id} {...stylex.props(styles.attachment)}>
              {url ? (
                <ImageContextMenu
                  source={{
                    url,
                    fileName: attachment.name,
                    mimeType: attachment.mimeType,
                    blob: blob ?? undefined,
                  }}
                  onCopy={onCopyImage}
                  onDownload={onDownloadImage}
                >
                  <div {...stylex.props(styles.thumbnail)}>
                  <Image
                    src={url}
                    alt={attachment.name}
                    width="100%"
                    height="100%"
                    style={{ display: "block", objectFit: "cover" }}
                    preview={{ mask: "查看" }}
                  />
                  </div>
                </ImageContextMenu>
              ) : (
                <div {...stylex.props(styles.thumbnail)}>
                  <span {...stylex.props(styles.missing)} title="本地图片已不可用">
                    <ImageOff size={18} aria-hidden="true" />
                  </span>
                </div>
              )}
              <figcaption title={attachment.name} {...stylex.props(styles.caption)}>
                <span {...stylex.props(styles.captionName)}>{attachment.name}</span>
                <small>{formatImageAttachmentBytes(attachment.size)}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <p {...stylex.props(styles.prompt)}>{message.prompt}</p>
    </div>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  attachments: {
    maxWidth: "100%",
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    scrollbarWidth: "thin",
  },
  attachment: {
    width: "112px",
    minWidth: "112px",
    margin: 0,
  },
  thumbnail: {
    width: "112px",
    height: "82px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
    cursor: "zoom-in",
    transitionProperty: "border-color, box-shadow, transform",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      borderColor: colors.primary,
      boxShadow: shadows.subtle,
      transform: "translateY(-1px)",
    },
    ":active": {
      transform: "scale(0.98)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  missing: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: colors.subtle,
  },
  caption: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    paddingTop: "5px",
    color: colors.muted,
    fontSize: "10px",
  },
  captionName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  prompt: {
    margin: 0,
    whiteSpace: "pre-wrap",
  },
});
