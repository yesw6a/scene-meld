import { useCallback, useState } from "react";

import {
  copyImageFromUrl,
  downloadImageFromUrl,
  ImageCopyError,
  type ImageActionSource,
} from "../lib/image-actions";

interface ToastApi {
  success: (content: string) => unknown;
  error: (content: string) => unknown;
}

export default function useImageCopyActions(toast: ToastApi) {
  const [recovery, setRecovery] = useState<{
    source: ImageActionSource;
    error: ImageCopyError;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);

  const copyImage = useCallback(async (source: ImageActionSource) => {
    try {
      await copyImageFromUrl(source);
      setRecovery(null);
      toast.success("图片已复制，可以粘贴到聊天、文档或图片软件中。");
    } catch (error) {
      setRecovery({ source, error: normalizeImageCopyError(error) });
    }
  }, [toast]);

  const downloadImage = useCallback(async (source: ImageActionSource) => {
    try {
      const result = await downloadImageFromUrl(source);
      if (result === "saved") toast.success("图片已保存。");
    } catch {
      toast.error("无法读取本地图片，请重新生成或重试。");
    }
  }, [toast]);

  const retryCopy = useCallback(async () => {
    if (!recovery || retrying) return;
    setRetrying(true);
    try {
      await copyImageFromUrl(recovery.source);
      setRecovery(null);
      toast.success("图片已复制，可以粘贴到聊天、文档或图片软件中。");
    } catch (error) {
      setRecovery((current) =>
        current ? { ...current, error: normalizeImageCopyError(error) } : current,
      );
    } finally {
      setRetrying(false);
    }
  }, [recovery, retrying, toast]);

  const downloadRecovery = useCallback(() => {
    if (!recovery) return;
    void downloadImage(recovery.source);
    setRecovery(null);
  }, [downloadImage, recovery]);

  const closeRecovery = useCallback(() => setRecovery(null), []);

  return {
    copyImage,
    downloadImage,
    recoveryError: recovery?.error ?? null,
    retrying,
    retryCopy,
    downloadRecovery,
    closeRecovery,
  };
}

function normalizeImageCopyError(error: unknown): ImageCopyError {
  if (error instanceof ImageCopyError) return error;
  const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return new ImageCopyError("unknown", "系统没有完成图片复制。", details.slice(0, 500));
}
