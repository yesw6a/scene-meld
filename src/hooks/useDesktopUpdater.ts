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
  source?: "github" | "proxy";
  phase?: "checking" | "downloading" | "verifying" | "installing";
  retrying?: boolean;
  downloaded?: number;
}

interface UseDesktopUpdaterOptions {
  busy: boolean;
}

interface DesktopUpdateController {
  snapshot: DesktopUpdateSnapshot;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

interface UpdateEvent {
  phase: NonNullable<DesktopUpdateSnapshot["phase"]>;
  source: "github" | "proxy";
  retrying: boolean;
  downloaded: number;
  total: number | null;
}

interface CheckResult {
  currentVersion: string;
  version: string | null;
  body: string | null;
  source: "github" | "proxy";
}

export default function useDesktopUpdater({ busy }: UseDesktopUpdaterOptions): DesktopUpdateController {
  const enabled = isDesktopRuntime() && import.meta.env.PROD;
  const available = useRef(false);
  const operation = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const checkStarted = useRef(false);
  const [snapshot, setSnapshot] = useState<DesktopUpdateSnapshot>(() => ({
    status: enabled ? "idle" : "disabled",
  }));

  const checkForUpdates = useCallback(async () => {
    if (!enabled || operation.current) {
      return;
    }

    operation.current = true;
    available.current = false;
    const id = ++generation.current;
    setSnapshot({
      status: "checking",
      source: "github",
      phase: "checking",
    });

    try {
      const { invoke, Channel } = await import("@tauri-apps/api/core");
      const onEvent = new Channel<UpdateEvent>();
      onEvent.onmessage = (event) => {
        if (mounted.current && generation.current === id) setSnapshot((current) => ({ ...current, ...event }));
      };
      const result = await invoke<CheckResult>("check_desktop_update", { onEvent });
      if (!mounted.current || generation.current !== id) return;
      available.current = Boolean(result.version);
      setSnapshot({
        status: result.version ? "available" : "idle",
        currentVersion: result.currentVersion,
        version: result.version ?? undefined,
        body: result.body ?? undefined,
        source: result.source,
        checkedAt: Date.now(),
      });
    } catch (error) {
      if (!mounted.current || generation.current !== id) return;
      setSnapshot((current) => ({
        ...current,
        status: "error",
        error: formatUpdaterError(error),
        checkedAt: Date.now(),
      }));
    } finally {
      if (generation.current === id) generation.current++;
      operation.current = false;
    }
  }, [enabled]);

  const installUpdate = useCallback(async () => {
    if (!enabled || !available.current || busy || operation.current) {
      return;
    }

    operation.current = true;
    available.current = false;
    const id = ++generation.current;
    setSnapshot((current) => ({ ...current, status: "downloading", phase: "downloading", progress: undefined, downloaded: 0, retrying: false, error: undefined }));

    try {
      const { invoke, Channel } = await import("@tauri-apps/api/core");
      const onEvent = new Channel<UpdateEvent>();
      onEvent.onmessage = (event) => {
        if (!mounted.current || generation.current !== id) return;
        setSnapshot((current) => ({
          ...current,
          ...event,
          status: event.phase === "installing" ? "installing" : "downloading",
          progress: event.phase === "installing" ? 100
            : event.phase === "verifying" ? current.progress
            : event.total ? Math.min(99, Math.floor(event.downloaded / event.total * 100)) : undefined,
          downloaded: event.phase === "verifying" ? current.downloaded : event.downloaded,
        }));
      };
      await invoke("install_desktop_update", { onEvent });
      if (!mounted.current || generation.current !== id) return;
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      if (!mounted.current || generation.current !== id) return;
      setSnapshot((current) => ({
        ...current,
        status: "error",
        error: formatUpdaterError(error),
      }));
    } finally {
      if (generation.current === id) generation.current++;
      operation.current = false;
    }
  }, [busy, enabled]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "检查桌面更新失败，请稍后重试。";
}
