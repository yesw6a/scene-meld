import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Image } from "antd";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type { ImageActionSource } from "../lib/image-actions";

interface GeneratedImagePreviewGroupProps {
  children: ReactNode;
  getSource: (url: string) => ImageActionSource;
  onCopyImage: (source: ImageActionSource) => void | Promise<void>;
  onDownloadImage: (source: ImageActionSource) => void | Promise<void>;
}

interface PreviewTransformIconNodes {
  flipYIcon: ReactNode;
  flipXIcon: ReactNode;
  rotateLeftIcon: ReactNode;
  rotateRightIcon: ReactNode;
  zoomOutIcon: ReactNode;
  zoomInIcon: ReactNode;
}

const previewIcons = {
  prev: <ChevronLeft size={30} strokeWidth={2.1} aria-hidden="true" />,
  next: <ChevronRight size={30} strokeWidth={2.1} aria-hidden="true" />,
  flipY: <FlipVertical2 size={18} strokeWidth={2} aria-hidden="true" />,
  flipX: <FlipHorizontal2 size={18} strokeWidth={2} aria-hidden="true" />,
  rotateLeft: <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />,
  rotateRight: <RotateCw size={18} strokeWidth={2} aria-hidden="true" />,
  zoomOut: <ZoomOut size={18} strokeWidth={2} aria-hidden="true" />,
  zoomIn: <ZoomIn size={18} strokeWidth={2} aria-hidden="true" />,
  close: <X size={20} strokeWidth={2} aria-hidden="true" />,
};

export default function GeneratedImagePreviewGroup({
  children,
  getSource,
  onCopyImage,
  onDownloadImage,
}: GeneratedImagePreviewGroupProps) {
  return (
    <Image.PreviewGroup
      icons={previewIcons}
      classNames={{
        popup: {
          root: "studio-image-preview",
          footer: "studio-image-preview-footer",
          actions: "studio-image-preview-transform-actions",
        },
      }}
      preview={{
        countRender: (current, total) => `第 ${current} / ${total} 张`,
        actionsRender: (originalNode, info) => {
          const source = getSource(info.image.url);
          return (
            <div className="studio-image-preview-toolbar">
              <PreviewImageActionButton
                icon={<Copy size={18} strokeWidth={2} aria-hidden="true" />}
                label="复制图片"
                onClick={() => onCopyImage(source)}
              />
              <PreviewImageActionButton
                icon={<Download size={18} strokeWidth={2} aria-hidden="true" />}
                label="下载图片"
                onClick={() => onDownloadImage(source)}
              />
              <span className="studio-image-preview-separator" aria-hidden="true" />
              <PreviewTransformActions originalNode={originalNode} icons={info.icons} />
            </div>
          );
        },
      }}
    >
      {children}
    </Image.PreviewGroup>
  );
}

function PreviewTransformActions({
  originalNode,
  icons,
}: {
  originalNode: ReactElement;
  icons: PreviewTransformIconNodes;
}) {
  const actions = [
    decoratePreviewAction(icons.flipYIcon, "垂直翻转", "studio-image-preview-transform-action"),
    decoratePreviewAction(icons.flipXIcon, "水平翻转", "studio-image-preview-transform-action"),
    decoratePreviewAction(
      icons.rotateLeftIcon,
      "向左旋转",
      "studio-image-preview-transform-action",
    ),
    decoratePreviewAction(
      icons.rotateRightIcon,
      "向右旋转",
      "studio-image-preview-transform-action",
    ),
    decoratePreviewAction(icons.zoomOutIcon, "缩小图片", "studio-image-preview-transform-action"),
    decoratePreviewAction(icons.zoomInIcon, "放大图片", "studio-image-preview-transform-action"),
  ];

  if (actions.some((action) => action === null)) {
    return originalNode;
  }

  return (
    <div
      className="studio-image-preview-transform-actions"
      role="group"
      aria-label="图片变换"
    >
      {actions}
    </div>
  );
}

function PreviewImageActionButton({
  icon,
  label,
  className,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className={["studio-image-preview-action", className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => void onClick()}
    >
      {icon}
    </button>
  );
}

function decoratePreviewAction(
  node: ReactNode,
  label: string,
  className: string,
): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>> | null {
  if (!isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(node)) {
    return null;
  }

  return cloneElement(node, {
    className: [node.props.className, "studio-image-preview-action", className]
      .filter(Boolean)
      .join(" "),
    "aria-label": label,
    title: label,
  });
}
