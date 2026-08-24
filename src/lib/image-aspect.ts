import type { ImageAspectStatus, ImageRequestSize } from "../types";

const ASPECT_RATIO_TOLERANCE = 0.03;

export interface ImageAspectInspection {
  status: Exclude<ImageAspectStatus, "retrying">;
  width?: number;
  height?: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

export function appendImageCanvasConstraint(
  prompt: string,
  size: ImageRequestSize,
): string {
  const dimensions = requestedImageDimensions(size);
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
  const requested = requestedImageDimensions(requestedSize);
  if (!requested) {
    return { status: "unverified" };
  }

  try {
    const actual = await readImageDimensions(dataUrl);
    const requestedRatio = requested.width / requested.height;
    const actualRatio = actual.width / actual.height;
    const relativeDifference = Math.abs(actualRatio - requestedRatio) / requestedRatio;

    return {
      status: relativeDifference <= ASPECT_RATIO_TOLERANCE ? "matched" : "mismatched",
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

function requestedImageDimensions(size: ImageRequestSize): ImageDimensions | null {
  const [rawWidth, rawHeight] = size.split("x");
  const width = Number(rawWidth);
  const height = Number(rawHeight);

  return isPositiveDimension(width) && isPositiveDimension(height)
    ? { width, height }
    : null;
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

function isPositiveDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
