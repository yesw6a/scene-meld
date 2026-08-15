import { useCallback, useEffect, useRef, useState } from "react";

import { isDesktopRuntime } from "../lib/runtime";

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export interface DesktopUpdateSnapshot {
  status: DesktopUpdateStatus;
  currentVersion?: string;
  version?: string;
  body?: string;
  progress?: number;
  error?: string;
  checkedAt?: number;
}

interface UseDesktopUpdaterOptions {
  busy: boolean;
}

interface DesktopUpdateController {
  snapshot: DesktopUpdateSnapshot;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

type UpdaterHandle = import("@tauri-apps/plugin-updater").Update;

export default function useDesktopUpdater({ busy }: UseDesktopUpdaterOptions): DesktopUpdateController {
  const enabled = isDesktopRuntime() && import.meta.env.PROD;
  const updateRef = useRef<UpdaterHandle | null>(null);
  const checkStarted = useRef(false);
  const [snapshot, setSnapshot] = useState<DesktopUpdateSnapshot>(() => ({
    status: enabled ? "idle" : "disabled",
  }));

  const checkForUpdates = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setSnapshot((current) => ({
      ...current,
      status: "checking",
      error: undefined,
      progress: undefined,
    }));

    try {
      const [{ check }, { getVersion }] = await Promise.all([
        import("@tauri-apps/plugin-updater"),
        import("@tauri-apps/api/app"),
      ]);
      const [update, currentVersion] = await Promise.all([check(), getVersion()]);

      if (!update) {
        updateRef.current = null;
        setSnapshot({ status: "idle", currentVersion, checkedAt: Date.now() });
        return;
      }

      updateRef.current = update;
      setSnapshot({
        status: "available",
        currentVersion: update.currentVersion || currentVersion,
        version: update.version,
        body: update.body,
        checkedAt: Date.now(),
      });
    } catch (error) {
      setSnapshot((current) => ({
        ...current,
        status: "error",
        error: formatUpdaterError(error),
        checkedAt: Date.now(),
      }));
    }
  }, [enabled]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!enabled || !update || busy) {
      return;
    }

    setSnapshot((current) => ({ ...current, status: "downloading", progress: 0, error: undefined }));

    try {
      let downloaded = 0;
      let total = 0;
      await update.download((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setSnapshot((current) => ({ ...current, progress: total ? 0 : undefined }));
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setSnapshot((current) => ({
            ...current,
            progress: total ? Math.min(100, Math.round((downloaded / total) * 100)) : undefined,
          }));
        }
      });

      setSnapshot((current) => ({ ...current, status: "installing", progress: 100 }));
      await update.install();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      setSnapshot((current) => ({
        ...current,
        status: "error",
        error: formatUpdaterError(error),
      }));
    }
  }, [busy, enabled]);

  useEffect(() => {
    if (!enabled || checkStarted.current) {
      return;
    }

    checkStarted.current = true;
    void checkForUpdates();
  }, [checkForUpdates, enabled]);

  return { snapshot, checkForUpdates, installUpdate };
}

function formatUpdaterError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "检查桌面更新失败，请稍后重试。";
}
