import type { ImageAspectStatus, ImageRequestSize } from "../types";
import { parseImageRequestSize } from "./image-model-capabilities";

export interface ImageAspectInspection {
  status: ImageAspectStatus;
  width?: number;
  height?: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

const IMAGE_ASPECT_RATIO_TOLERANCE = 0.005;

export function appendImageCanvasConstraint(
  prompt: string,
  size: ImageRequestSize,
): string {
  const dimensions = parseImageRequestSize(size);
  if (!dimensions) {
    return prompt;
  }

  const orientation = dimensions.width === dimensions.height
    ? "square"
    : dimensions.width > dimensions.height
      ? "landscape"
      : "portrait";
  const ratio = formatImageAspectRatio(dimensions.width, dimensions.height);
  const constraint =
    `Canvas requirement: use a ${dimensions.width}x${dimensions.height} ${orientation} canvas (${ratio}). ` +
    "Preserve this aspect ratio and do not return a different orientation.";

  return `${prompt}\n\n${constraint}`;
}

export async function inspectGeneratedImageAspect(
  dataUrl: string,
  requestedSize: ImageRequestSize,
): Promise<ImageAspectInspection> {
  const requested = parseImageRequestSize(requestedSize);
  if (!requested) {
    return { status: "unverified" };
  }

  try {
    const actual = await readImageDimensions(dataUrl);
    return {
      status: hasMatchingAspectRatio(requested, actual) ? "matched" : "mismatched",
      width: actual.width,
      height: actual.height,
    };
  } catch {
    return { status: "unverified" };
  }
}

export function formatImageAspectRatio(width: number, height: number): string {
  if (!isPositiveDimension(width) || !isPositiveDimension(height)) {
    return "unknown";
  }

  const divisor = greatestCommonDivisor(Math.round(width), Math.round(height));
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`;
}

export function imageDimensionMismatchMessage(
  requestedSize: ImageRequestSize,
  actualWidth?: number,
  actualHeight?: number,
): string {
  const requestedDimensions = parseImageRequestSize(requestedSize);
  const requested = requestedDimensions
    ? `${formatImageAspectRatio(requestedDimensions.width, requestedDimensions.height)}（${requestedDimensions.width} × ${requestedDimensions.height}）`
    : "自动比例";
  if (!actualWidth || !actualHeight) {
    return `请求 ${requested}，但无法验证模型返回图片的实际尺寸。`;
  }
  return `请求 ${requested}，模型实际返回 ${formatImageAspectRatio(actualWidth, actualHeight)}（${actualWidth} × ${actualHeight}）。`;
}

export function imageActualDimensionLabel(
  requestedSize: ImageRequestSize,
  status: ImageAspectStatus | undefined,
  actualWidth?: number,
  actualHeight?: number,
): string | undefined {
  if (status !== "matched" || !actualWidth || !actualHeight) {
    return undefined;
  }

  const requested = parseImageRequestSize(requestedSize);
  if (
    !requested ||
    (actualWidth === requested.width && actualHeight === requested.height)
  ) {
    return undefined;
  }

  return `实际 ${actualWidth} × ${actualHeight}`;
}

function readImageDimensions(dataUrl: string): Promise<ImageDimensions> {
  if (typeof window === "undefined" || typeof window.Image !== "function") {
    return Promise.reject(new Error("Image dimensions are unavailable in this runtime."));
  }

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      if (isPositiveDimension(width) && isPositiveDimension(height)) {
        resolve({ width, height });
      } else {
        reject(new Error("Generated image has invalid dimensions."));
      }
    };
    image.onerror = () => reject(new Error("Generated image dimensions could not be read."));
    image.src = dataUrl;
  });
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

function hasMatchingAspectRatio(
  requested: ImageDimensions,
  actual: ImageDimensions,
): boolean {
  const requestedRatio = requested.width / requested.height;
  const actualRatio = actual.width / actual.height;
  return Math.abs(actualRatio / requestedRatio - 1) <= IMAGE_ASPECT_RATIO_TOLERANCE;
}

function isPositiveDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
