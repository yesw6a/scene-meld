import type { ImageOrientation, ImageRequestSize, ImageSize } from "../types";

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
    value: "1536x864",
    label: "桌面",
    ratio: "16:9",
    dimensions: "1536 × 864",
    orientation: "landscape",
  },
  {
    value: "864x1536",
    label: "手机",
    ratio: "9:16",
    dimensions: "864 × 1536",
    orientation: "portrait",
  },
  {
    value: "1024x1024",
    label: "正方形",
    ratio: "1:1",
    dimensions: "1024 × 1024",
    orientation: "square",
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
  "1536x1024": "1536x864",
  "1024x1536": "864x1536",
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
    return `${option.label} · ${option.ratio}`;
  }

  const [width, height] = parseImageSize(size);
  if (!width || !height) {
    return size;
  }

  return `${orientationLabel(imageOrientationFromDimensions(width, height))} · ${width} × ${height}`;
}

export function imageOrientation(size: ImageRequestSize): ImageOrientation {
  const [width, height] = parseImageSize(size);
  return imageOrientationFromDimensions(width, height);
}

export function imageOrientationFromDimensions(
  width: number,
  height: number,
): ImageOrientation {
  if (!width || !height || Math.abs(width - height) / Math.max(width, height) < 0.08) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

export function imageAspectRatio(size: ImageRequestSize): string {
  const [width, height] = parseImageSize(size);
  return width && height ? `${width} / ${height}` : "1 / 1";
}

export function imagePreviewSizing(size: ImageRequestSize): ImagePreviewSizing {
  const [width, height] = parseImageSize(size);
  return imagePreviewSizingFromDimensions(width, height);
}

export function imagePreviewSizingFromDimensions(
  width: number,
  height: number,
): ImagePreviewSizing {
  const safeWidth = width > 0 && Number.isFinite(width) ? width : 1;
  const safeHeight = height > 0 && Number.isFinite(height) ? height : 1;

  return {
    desktopWidth: fittedPreviewWidth(
      safeWidth,
      safeHeight,
      PREVIEW_DESKTOP_MAX_HEIGHT,
    ),
    mobileWidth: fittedPreviewWidth(
      safeWidth,
      safeHeight,
      PREVIEW_MOBILE_MAX_HEIGHT,
    ),
    aspectRatio: `${safeWidth} / ${safeHeight}`,
  };
}

function parseImageSize(size: ImageRequestSize): [number, number] {
  const [width, height] = size.split("x").map(Number);
  return [Number.isFinite(width) ? width : 0, Number.isFinite(height) ? height : 0];
}

function fittedPreviewWidth(width: number, height: number, maxHeight: number): number {
  return Math.max(1, Math.round(Math.min(PREVIEW_MAX_WIDTH, (maxHeight * width) / height)));
}

function orientationLabel(orientation: ImageOrientation): string {
  return {
    landscape: "横屏",
    portrait: "竖屏",
    square: "正方形",
  }[orientation];
}
