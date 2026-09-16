import type { ImageRequestSize } from "../types";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageSizeValidation {
  valid: boolean;
  message?: string;
}

export const GPT_IMAGE_2_CAPABILITIES = {
  maxEdge: 3840,
  dimensionStep: 16,
  maxAspectRatio: 3,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  preferredMaxEdge: 1536,
  outputFormat: "png",
} as const;

export function parseImageRequestSize(size: ImageRequestSize): ImageDimensions | null {
  if (size === "auto") {
    return null;
  }

  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    ? { width, height }
    : null;
}

export function validateGptImage2Dimensions(
  dimensions: ImageDimensions,
): ImageSizeValidation {
  const { width, height } = dimensions;
  const capabilities = GPT_IMAGE_2_CAPABILITIES;

  if (width % capabilities.dimensionStep || height % capabilities.dimensionStep) {
    return {
      valid: false,
      message: "图片宽度和高度都必须是 16 的倍数。",
    };
  }

  if (Math.max(width, height) > capabilities.maxEdge) {
    return {
      valid: false,
      message: "图片最长边不能超过 3840 像素。",
    };
  }

  if (Math.max(width, height) / Math.min(width, height) > capabilities.maxAspectRatio) {
    return {
      valid: false,
      message: "当前应用支持的最长边不能超过最短边的 3 倍。",
    };
  }

  const pixels = width * height;
  if (pixels < capabilities.minPixels || pixels > capabilities.maxPixels) {
    return {
      valid: false,
      message: "图片总像素必须在 655,360 到 8,294,400 之间。",
    };
  }

  return { valid: true };
}

export function resolveGptImage2Ratio(
  rawWidth: number,
  rawHeight: number,
): { ratio: string; size?: ImageRequestSize; error?: string } {
  if (!Number.isInteger(rawWidth) || !Number.isInteger(rawHeight) || rawWidth <= 0 || rawHeight <= 0) {
    return { ratio: `${rawWidth}:${rawHeight}`, error: "画面比例必须由两个正整数构成。" };
  }

  const divisor = greatestCommonDivisor(rawWidth, rawHeight);
  const ratioWidth = rawWidth / divisor;
  const ratioHeight = rawHeight / divisor;
  const ratio = `${ratioWidth}:${ratioHeight}`;
  const maxRatio = Math.max(ratioWidth, ratioHeight) / Math.min(ratioWidth, ratioHeight);
  if (maxRatio > GPT_IMAGE_2_CAPABILITIES.maxAspectRatio) {
    return {
      ratio,
      error: "当前应用支持的最长边不能超过最短边的 3 倍。建议改为 1:3，或选择 9:16。",
    };
  }

  const baseWidth = GPT_IMAGE_2_CAPABILITIES.dimensionStep * ratioWidth;
  const baseHeight = GPT_IMAGE_2_CAPABILITIES.dimensionStep * ratioHeight;
  const maxScale = Math.floor(
    GPT_IMAGE_2_CAPABILITIES.maxEdge / Math.max(baseWidth, baseHeight),
  );
  const preferredScale = Math.max(
    1,
    Math.floor(
      GPT_IMAGE_2_CAPABILITIES.preferredMaxEdge / Math.max(baseWidth, baseHeight),
    ),
  );

  const candidates: Array<ImageDimensions & { scale: number }> = [];
  for (let scale = 1; scale <= maxScale; scale += 1) {
    const candidate = { width: baseWidth * scale, height: baseHeight * scale };
    if (validateGptImage2Dimensions(candidate).valid) {
      candidates.push({ ...candidate, scale });
    }
  }

  const selected = [...candidates].sort(
    (left, right) =>
      Math.abs(left.scale - preferredScale) - Math.abs(right.scale - preferredScale),
  )[0];
  if (!selected) {
    return {
      ratio,
      error: "这个比例无法精确换算为应用支持的尺寸。请使用更常见的整数比例。",
    };
  }

  return {
    ratio,
    size: `${selected.width}x${selected.height}` as ImageRequestSize,
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  let dividend = Math.abs(left);
  let divisor = Math.abs(right);
  while (divisor) {
    const remainder = dividend % divisor;
    dividend = divisor;
    divisor = remainder;
  }
  return dividend || 1;
}
