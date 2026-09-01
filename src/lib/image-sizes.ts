import type { ImageOrientation, ImageRequestSize, ImageSize } from "../types";
import { parseImageRequestSize } from "./image-model-capabilities";
import { formatImageAspectRatio } from "./image-aspect";

export interface ImageSizeOption {
  value: ImageSize;
  label: string;
  ratio: string;
  dimensions: string;
  orientation: ImageOrientation;
}

export interface ImagePreviewSizing {
  desktopWidth: number;
  mobileWidth: number;
  aspectRatio: string;
}

const PREVIEW_MAX_WIDTH = 480;
const PREVIEW_DESKTOP_MAX_HEIGHT = 280;
const PREVIEW_MOBILE_MAX_HEIGHT = 220;

export const IMAGE_SIZE_OPTIONS = [
  {
    value: "auto",
    label: "自动",
    ratio: "模型决定",
    dimensions: "不保证固定比例",
    orientation: "auto",
  },
  {
    value: "1024x1024",
    label: "正方形",
    ratio: "1:1",
    dimensions: "1024 × 1024",
    orientation: "square",
  },
  {
    value: "1536x864",
    label: "宽屏",
    ratio: "16:9",
    dimensions: "1536 × 864",
    orientation: "landscape",
  },
  {
    value: "864x1536",
    label: "竖屏",
    ratio: "9:16",
    dimensions: "864 × 1536",
    orientation: "portrait",
  },
  {
    value: "1536x1024",
    label: "横向照片",
    ratio: "3:2",
    dimensions: "1536 × 1024",
    orientation: "landscape",
  },
  {
    value: "1024x1536",
    label: "纵向照片",
    ratio: "2:3",
    dimensions: "1024 × 1536",
    orientation: "portrait",
  },
] as const satisfies readonly ImageSizeOption[];

export const IMAGE_SIZE_SELECT_OPTIONS = IMAGE_SIZE_OPTIONS.map((option) => ({
  label: `${option.label} · ${option.ratio} · ${option.dimensions}`,
  value: option.value,
}));

export const IMAGE_SIZE_VALUES = new Set<ImageSize>(
  IMAGE_SIZE_OPTIONS.map((option) => option.value),
);

const LEGACY_SIZE_MIGRATIONS: Record<string, ImageSize> = {
  "1792x1024": "1536x864",
  "1024x1792": "864x1536",
};

export function migrateImageSize(value: unknown): ImageSize {
  if (typeof value !== "string") {
    return "1024x1024";
  }
  if (IMAGE_SIZE_VALUES.has(value as ImageSize)) {
    return value as ImageSize;
  }
  return LEGACY_SIZE_MIGRATIONS[value] ?? "1024x1024";
}

export function imageSizeLabel(size: ImageRequestSize): string {
  const option = IMAGE_SIZE_OPTIONS.find((item) => item.value === size);
  if (option) {
    return option.value === "auto"
      ? "自动 · 模型决定"
      : `${option.label} · ${option.ratio}`;
  }
  const dimensions = parseImageRequestSize(size);
  return dimensions
    ? `自定义 · ${formatImageAspectRatio(dimensions.width, dimensions.height)}`
    : String(size);
}

export function imageRequestLabel(size: ImageRequestSize): string {
  if (size === "auto") {
    return "自动比例（模型决定）";
  }
  const dimensions = parseImageRequestSize(size);
  return dimensions
    ? `${formatImageAspectRatio(dimensions.width, dimensions.height)}（${dimensions.width} × ${dimensions.height}）`
    : String(size);
}

export function imageOrientation(size: ImageRequestSize): ImageOrientation {
  if (size === "auto") {
    return "auto";
  }
  const dimensions = parseImageRequestSize(size);
  return dimensions
    ? imageOrientationFromDimensions(dimensions.width, dimensions.height)
    : "square";
}

export function imageOrientationFromDimensions(
  width: number,
  height: number,
): Exclude<ImageOrientation, "auto"> {
  if (!width || !height || Math.abs(width - height) / Math.max(width, height) < 0.08) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}

export function imageAspectRatio(size: ImageRequestSize): string {
  const dimensions = parseImageRequestSize(size);
  return dimensions ? `${dimensions.width} / ${dimensions.height}` : "1 / 1";
}

export function imagePreviewSizing(size: ImageRequestSize): ImagePreviewSizing {
  const dimensions = parseImageRequestSize(size) ?? { width: 1, height: 1 };
  return imagePreviewSizingFromDimensions(dimensions.width, dimensions.height);
}

export function imagePreviewSizingFromDimensions(
  width: number,
  height: number,
): ImagePreviewSizing {
  const safeWidth = width > 0 && Number.isFinite(width) ? width : 1;
  const safeHeight = height > 0 && Number.isFinite(height) ? height : 1;
  return {
    desktopWidth: fittedPreviewWidth(safeWidth, safeHeight, PREVIEW_DESKTOP_MAX_HEIGHT),
    mobileWidth: fittedPreviewWidth(safeWidth, safeHeight, PREVIEW_MOBILE_MAX_HEIGHT),
    aspectRatio: `${safeWidth} / ${safeHeight}`,
  };
}

function fittedPreviewWidth(width: number, height: number, maxHeight: number): number {
  return Math.max(1, Math.round(Math.min(PREVIEW_MAX_WIDTH, (maxHeight * width) / height)));
}
