import { isDesktopRuntime } from "./runtime";
import { arrayBufferToBase64 } from "./base64";

export type ImageSaveResult = "saved" | "cancelled" | "started";

export async function saveImageBlob(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<ImageSaveResult> {
  if (isDesktopRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const saved = await invoke<boolean>("save_image_file", {
      request: {
        fileName,
        mimeType,
        base64: arrayBufferToBase64(await blob.arrayBuffer()),
      },
    });
    return saved ? "saved" : "cancelled";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return "started";
}
