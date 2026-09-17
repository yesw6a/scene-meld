import { useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Tooltip } from "antd";
import type { ReactElement } from "react";
import {
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import BrandMark from "./BrandMark";
import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";
import { isDesktopRuntime } from "../lib/runtime";
import { updateActivityLabel } from "../lib/updatePresentation";
import { updaterStyles } from "../styles/updater.stylex";
import { desktopChrome } from "../styles/desktop-chrome.stylex";
import { colors, motion, radii } from "../styles/tokens.stylex";

interface WindowChromeProps {
  updateSnapshot?: DesktopUpdateSnapshot;
  onOpenUpdates?: () => void;
  onCheckForUpdates?: () => void | Promise<void>;
}

interface DesktopWindowApi {
  close: () => Promise<void>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<() => void>;
}

export default function WindowChrome({
  updateSnapshot,
  onOpenUpdates,
  onCheckForUpdates,
}: WindowChromeProps) {
  const desktop = isDesktopRuntime();
  const chromeRef = useRef<HTMLElement>(null);
  const [windowApi, setWindowApi] = useState<DesktopWindowApi | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [initializing, setInitializing] = useState(desktop);
  const [windowError, setWindowError] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) {
      setInitializing(false);
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const reportError = (action: string, error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[WindowChrome] ${action} failed: ${detail}`, error);
      if (!disposed) {
        setWindowError(`${action}失败`);
      }
    };

    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const current = getCurrentWindow();
        const api: DesktopWindowApi = {
          close: async () => {
            if (import.meta.env.DEV) {
              const { exit } = await import("@tauri-apps/plugin-process");
              await exit(0);
              return;
            }

            await current.close();
          },
          minimize: () => current.minimize(),
          toggleMaximize: () => current.toggleMaximize(),
          isMaximized: () => current.isMaximized(),
          onResized: (handler) => current.onResized(handler),
        };

        if (disposed) {
          return;
        }

        const initialMaximized = await api.isMaximized();
        if (disposed) {
          return;
        }

        setWindowApi(api);
        setMaximized(initialMaximized);
        setInitializing(false);

        try {
          const cleanup = await api.onResized(() => {
            void api
              .isMaximized()
              .then(setMaximized)
              .catch((error: unknown) => reportError("同步窗口状态", error));
          });
          if (disposed) {
            cleanup();
          } else {
            unlisten = cleanup;
          }
        } catch (error) {
          reportError("监听窗口状态", error);
        }
      } catch (error) {
        setInitializing(false);
        reportError("初始化窗口控制", error);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [desktop]);

  if (!desktop) {
    return null;
  }

  const runWindowAction = async (
    action: string,
    operation: (api: DesktopWindowApi) => Promise<void>,
  ) => {
    const api = windowApi;
    if (!api || initializing) {
      return;
    }

    try {
      await operation(api);
      setWindowError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[WindowChrome] ${action} failed: ${detail}`, error);
      setWindowError(`${action}失败`);
    }
  };

  const toggleMaximize = () =>
    runWindowAction("切换最大化", async (api) => {
      await api.toggleMaximize();
      setMaximized(await api.isMaximized());
    });

  const controlsDisabled = initializing || !windowApi;
  const getChromePopupContainer = () => chromeRef.current ?? document.body;

  return (
    <header
      ref={chromeRef}
      {...stylex.props(styles.root)}
      aria-label="SceneMeld 窗口标题栏"
      aria-busy={initializing}
    >
      <div
        {...stylex.props(styles.dragRegion)}
        data-tauri-drag-region="deep"
        onDoubleClick={() => void toggleMaximize()}
      >
        <div {...stylex.props(styles.identity)}>
          <span {...stylex.props(styles.iconTile)} aria-hidden="true">
            <BrandMark size={22} />
          </span>
          <strong {...stylex.props(styles.title)}>SceneMeld</strong>
        </div>
      </div>

      <div {...stylex.props(styles.statusRegion)} data-tauri-drag-region="false">
        {updateSnapshot && onOpenUpdates ? (
          <UpdateChip
            snapshot={updateSnapshot}
            onOpenUpdates={onOpenUpdates}
            onCheckForUpdates={onCheckForUpdates}
            getPopupContainer={getChromePopupContainer}
          />
        ) : null}
      </div>

      <div {...stylex.props(styles.controls)} data-tauri-drag-region="false">
        <Tooltip title="最小化" placement="bottom" getPopupContainer={getChromePopupContainer}>
          <button
            type="button"
            {...stylex.props(styles.control)}
            aria-label="最小化窗口"
            disabled={controlsDisabled}
            onClick={() =>
              void runWindowAction("最小化窗口", (api) => api.minimize())
            }
          >
            <Minus size={15} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip
          title={maximized ? "还原" : "最大化"}
          placement="bottom"
          getPopupContainer={getChromePopupContainer}
        >
          <button
            type="button"
            {...stylex.props(styles.control)}
            aria-label={maximized ? "还原窗口" : "最大化窗口"}
            disabled={controlsDisabled}
            onClick={() => void toggleMaximize()}
          >
            {maximized ? (
              <Minimize2 size={14} aria-hidden="true" />
            ) : (
              <Maximize2 size={14} aria-hidden="true" />
            )}
          </button>
        </Tooltip>
        <Tooltip title="关闭" placement="bottom" getPopupContainer={getChromePopupContainer}>
          <button
            type="button"
            {...stylex.props(styles.control, styles.closeControl)}
            aria-label="关闭窗口"
            disabled={controlsDisabled}
            onClick={() =>
              void runWindowAction("关闭窗口", (api) => api.close())
            }
          >
            <X size={15} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      {windowError ? (
        <span {...stylex.props(styles.srOnly)} role="status" aria-live="polite">
          {windowError}
        </span>
      ) : null}
    </header>
  );
}

interface UpdateChipProps {
  snapshot: DesktopUpdateSnapshot;
  onOpenUpdates: () => void;
  onCheckForUpdates?: () => void | Promise<void>;
  getPopupContainer: (triggerNode: HTMLElement) => HTMLElement;
}

function UpdateChip({
  snapshot,
  onOpenUpdates,
  onCheckForUpdates,
  getPopupContainer,
}: UpdateChipProps) {
  const presentation = getUpdatePresentation(snapshot);
  if (!presentation) {
    return null;
  }

  const active = ["checking", "downloading", "installing"].includes(snapshot.status);
  const tone =
    presentation.tone === "available"
      ? styles.updateChipAvailable
      : presentation.tone === "error"
        ? styles.updateChipError
        : styles.updateChipBusy;
  const handleClick = () => {
    if (snapshot.status === "error" && onCheckForUpdates) {
      void onCheckForUpdates();
      return;
    }

    onOpenUpdates();
  };

  return (
    <Tooltip
      title={presentation.tooltip}
      placement="bottom"
      getPopupContainer={getPopupContainer}
    >
      <button
        type="button"
        {...stylex.props(styles.updateChip, tone)}
        aria-label={presentation.ariaLabel}
        aria-live={snapshot.status === "available" || snapshot.status === "error" ? "polite" : "off"}
        aria-busy={active}
        onClick={handleClick}
      >
        <span {...stylex.props(styles.updateChipIcon, active && updaterStyles.spinning)} aria-hidden="true">
          {presentation.icon}
        </span>
        <span {...stylex.props(styles.updateChipLabel)}>{presentation.label}</span>
      </button>
    </Tooltip>
  );
}

function getUpdatePresentation(snapshot: DesktopUpdateSnapshot): {
  icon: ReactElement;
  label: string;
  tooltip: string;
  ariaLabel: string;
  tone: "available" | "busy" | "error";
} | null {
  switch (snapshot.status) {
    case "available":
      return {
        icon: <Sparkles size={14} aria-hidden="true" />,
        label: `有新版本 ${snapshot.version ?? ""}`.trim(),
        tooltip: "打开桌面更新详情",
        ariaLabel: `有新版本 ${snapshot.version ?? ""}，打开更新详情`.trim(),
        tone: "available",
      };
    case "checking":
      return {
        icon: <LoaderCircle size={14} aria-hidden="true" />,
        label: snapshot.source === "proxy" ? "加速源检查中" : "检查更新中",
        tooltip: updateActivityLabel(snapshot),
        ariaLabel: `${updateActivityLabel(snapshot)}，打开更新详情`,
        tone: "busy",
      };
    case "downloading":
      return {
        icon: <LoaderCircle size={14} aria-hidden="true" />,
        label: snapshot.phase === "verifying" ? "校验更新包中" :
          typeof snapshot.progress === "number"
            ? `下载更新 ${snapshot.progress}%`
            : "下载更新中",
        tooltip: updateActivityLabel(snapshot),
        ariaLabel: `${updateActivityLabel(snapshot)}，打开更新详情`,
        tone: "busy",
      };
    case "installing":
      return {
        icon: <LoaderCircle size={14} aria-hidden="true" />,
        label: "安装更新中",
        tooltip: "更新即将完成",
        ariaLabel: "桌面更新准备重启",
        tone: "busy",
      };
    case "error":
      return {
        icon: <TriangleAlert size={14} aria-hidden="true" />,
        label: "更新失败，重试",
        tooltip: "重新检查桌面更新",
        ariaLabel: "桌面更新检查失败，重新检查",
        tone: "error",
      };
    default:
      return null;
  }
}

const styles = stylex.create({
  root: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: desktopChrome.chromeLayer,
    height: desktopChrome.height,
    minHeight: desktopChrome.height,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "0 8px 0 12px",
    color: colors.muted,
    backgroundColor: colors.glassChrome,
    WebkitBackdropFilter: "blur(24px) saturate(160%)",
    backdropFilter: "blur(24px) saturate(160%)",
    userSelect: "none",
  },
  dragRegion: {
    minWidth: 0,
    height: "100%",
    flex: 1,
    display: "flex",
    alignItems: "center",
    cursor: "default",
    userSelect: "none",
  },
  identity: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    pointerEvents: "none",
  },
  iconTile: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.small,
  },
  title: {
    color: colors.ink,
    fontSize: "13px",
    fontWeight: 650,
    letterSpacing: "0.01em",
    lineHeight: 1.2,
  },
  controls: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "2px",
  },
  statusRegion: {
    minWidth: 0,
    flexShrink: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingInline: "6px",
  },
  updateChip: {
    minWidth: 0,
    maxWidth: "min(300px, 34vw)",
    minHeight: "30px",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 10px",
    color: colors.body,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    cursor: "pointer",
    transitionProperty: "color, background-color, border-color, box-shadow, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.ink,
      backgroundColor: colors.glassChrome,
      borderColor: colors.borderStrong,
    },
    ":active": { transform: "scale(0.98)" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
      outlineOffset: "2px",
    },
    ":disabled": {
      cursor: "wait",
      opacity: 0.8,
    },
    "@media (max-width: 767px)": {
      maxWidth: "180px",
      minHeight: "26px",
      paddingInline: "8px",
      fontSize: "11px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  updateChipAvailable: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoftHover,
  },
  updateChipBusy: {
    color: colors.muted,
  },
  updateChipError: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoftHover,
  },
  updateChipIcon: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
  },
  updateChipLabel: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "11px",
    fontWeight: 650,
  },
  control: {
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
    color: colors.muted,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.small,
    cursor: "pointer",
    transitionProperty: "color, background-color, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": { color: colors.ink, backgroundColor: colors.glassSubtle },
    ":active": { transform: "scale(0.94)" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
      outlineOffset: "-2px",
    },
    ":disabled": {
      opacity: 0.5,
      cursor: "default",
    },
    "@media (max-width: 767px)": {
      width: "32px",
      height: "32px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  closeControl: {
    ":hover": { color: colors.onPrimary, backgroundColor: colors.danger },
    ":disabled:hover": { color: colors.muted, backgroundColor: "transparent" },
  },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});
