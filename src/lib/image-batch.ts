import {
  DEFAULT_IMAGE_QUANTITY,
  IMAGE_BATCH_CONCURRENCY,
  MAX_IMAGE_BATCH_SIZE,
} from "../types";

export type ImageBatchTask<T> = (signal: AbortSignal) => Promise<T>;

export interface ImageBatchTaskResult<T> {
  index: number;
  status: "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
}

export interface RunImageBatchOptions<T> {
  signal: AbortSignal;
  concurrency?: number;
  onSettled?: (result: ImageBatchTaskResult<T>) => void | Promise<void>;
}

export function normalizeImageQuantity(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_IMAGE_QUANTITY;
  }

  return Math.min(
    MAX_IMAGE_BATCH_SIZE,
    Math.max(DEFAULT_IMAGE_QUANTITY, Math.round(numericValue)),
  );
}

export function isImageBatchAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function createImageBatchAbortError(): Error {
  const error = new Error("The image batch was cancelled.");
  error.name = "AbortError";
  return error;
}

export async function runImageBatch<T>(
  tasks: readonly ImageBatchTask<T>[],
  options: RunImageBatchOptions<T>,
): Promise<ImageBatchTaskResult<T>[]> {
  if (tasks.length === 0) {
    return [];
  }

  const concurrency = Math.min(
    tasks.length,
    Math.max(1, Math.floor(options.concurrency ?? IMAGE_BATCH_CONCURRENCY)),
  );
  const results: Array<ImageBatchTaskResult<T> | undefined> = Array.from(
    { length: tasks.length },
    () => undefined,
  );
  let nextIndex = 0;

  const settle = async (result: ImageBatchTaskResult<T>) => {
    results[result.index] = result;
    try {
      await options.onSettled?.(result);
    } catch {
      // A per-image persistence/render update must not stop the remaining workers.
    }
  };

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) {
        return;
      }

      if (options.signal.aborted) {
        await settle({
          index,
          status: "rejected",
          reason: createImageBatchAbortError(),
        });
        continue;
      }

      const controller = new AbortController();
      const abortChild = () => controller.abort();
      options.signal.addEventListener("abort", abortChild, { once: true });
      if (options.signal.aborted) {
        controller.abort();
      }

      try {
        const value = await tasks[index](controller.signal);
        await settle({ index, status: "fulfilled", value });
      } catch (reason) {
        await settle({ index, status: "rejected", reason });
      } finally {
        options.signal.removeEventListener("abort", abortChild);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results as ImageBatchTaskResult<T>[];
}
