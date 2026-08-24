import type { ReactNode } from "react";
import { Copy, Download } from "lucide-react";

import type { ImageActionSource } from "../lib/image-actions";
import type { ContextMenuEntry } from "./AppContextMenu";
import ContextMenuTarget from "./ContextMenuTarget";

interface ImageContextMenuProps {
  source: ImageActionSource;
  onCopy: (source: ImageActionSource) => void | Promise<void>;
  onDownload: (source: ImageActionSource) => void | Promise<void>;
  children: ReactNode;
}

export default function ImageContextMenu({
  source,
  onCopy,
  onDownload,
  children,
}: ImageContextMenuProps) {
  const entries: ContextMenuEntry[] = [
    {
      key: "copy-image",
      label: "复制图片",
      icon: <Copy size={16} aria-hidden="true" />,
      onSelect: () => onCopy(source),
    },
    {
      key: "download-image",
      label: "下载图片",
      icon: <Download size={16} aria-hidden="true" />,
      onSelect: () => onDownload(source),
    },
  ];

  return (
    <ContextMenuTarget className="studio-image-context-target" entries={entries}>
      {children}
    </ContextMenuTarget>
  );
}
