import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as stylex from "@stylexjs/stylex";
import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

import {
  appearancePalette,
  darkColorsTheme,
  darkShadowsTheme,
} from "../styles/tokens.stylex";
import {
  desktopChrome,
  desktopDrawerOverlayStyles,
  desktopModalOverlayStyles,
} from "../styles/desktop-chrome.stylex";
import { isDesktopRuntime } from "../lib/runtime";

export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedAppearanceMode = Exclude<AppearanceMode, "system">;

interface AppearanceContextValue {
  mode: AppearanceMode;
  resolvedMode: ResolvedAppearanceMode;
  setMode: (mode: AppearanceMode) => void;
}

const STORAGE_KEY = "scenemeld.appearance.v1";
const LEGACY_STORAGE_KEY = "gpt-image-2-studio.appearance.v1";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const DARK_THEME_CLASS_NAMES =
  stylex.props(darkColorsTheme, darkShadowsTheme).className?.split(" ").filter(Boolean) ?? [];
const desktopDrawerConfig = { styles: desktopDrawerOverlayStyles };
const desktopModalConfig = { styles: desktopModalOverlayStyles };
const feedbackOverlayStyles = {
  list: { zIndex: desktopChrome.overlayCeiling },
};
const feedbackConfig = { styles: feedbackOverlayStyles };
const desktopFeedbackConfig = {
  ...feedbackConfig,
  top: desktopChrome.feedbackTop,
};

export default function AppearanceProvider({ children }: { children: ReactNode }) {
  const desktop = isDesktopRuntime();
  const [mode, setModeState] = useState<AppearanceMode>(loadAppearanceMode);
  const [systemMode, setSystemMode] = useState<ResolvedAppearanceMode>(getSystemMode);
  const resolvedMode = mode === "system" ? systemMode : mode;

  useEffect(() => {
    if (mode !== "system") {
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemMode(event.matches ? "dark" : "light");
    };

    setSystemMode(query.matches ? "dark" : "light");
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedMode;
    root.style.colorScheme = resolvedMode;
    for (const className of DARK_THEME_CLASS_NAMES) {
      root.classList.toggle(className, resolvedMode === "dark");
    }

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", appearancePalette[resolvedMode].canvas);

    return () => {
      for (const className of DARK_THEME_CLASS_NAMES) {
        root.classList.remove(className);
      }
    };
  }, [resolvedMode]);

  const setMode = useCallback((nextMode: AppearanceMode) => {
    setModeState(nextMode);
    saveAppearanceMode(nextMode);
  }, []);

  const contextValue = useMemo(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode],
  );
  const themeConfig = useMemo(() => createThemeConfig(resolvedMode), [resolvedMode]);
  const darkMode = resolvedMode === "dark";
  const mergedFeedbackConfig = desktop ? desktopFeedbackConfig : feedbackConfig;

  return (
    <AppearanceContext.Provider value={contextValue}>
      <div
        data-appearance={resolvedMode}
        {...stylex.props(
          styles.root,
          darkMode && darkColorsTheme,
          darkMode && darkShadowsTheme,
        )}
      >
        <ConfigProvider
          theme={themeConfig}
          drawer={desktop ? desktopDrawerConfig : undefined}
          modal={desktop ? desktopModalConfig : undefined}
        >
          <AntdApp
            message={mergedFeedbackConfig}
            notification={mergedFeedbackConfig}
          >
            {children}
          </AntdApp>
        </ConfigProvider>
      </div>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside AppearanceProvider.");
  }
  return context;
}

function getSystemMode(): ResolvedAppearanceMode {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadAppearanceMode(): AppearanceMode {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const currentValue = window.localStorage.getItem(STORAGE_KEY);
    const legacyValue = currentValue
      ? null
      : window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const rawValue = currentValue ?? legacyValue;
    if (!rawValue) {
      return "system";
    }

    const stored = JSON.parse(rawValue) as { version?: number; mode?: unknown };
    const mode =
      stored.version === 1 && isAppearanceMode(stored.mode) ? stored.mode : "system";
    if (legacyValue) {
      saveAppearanceMode(mode);
    }
    return mode;
  } catch {
    return "system";
  }
}

function saveAppearanceMode(mode: AppearanceMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode }));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // 外观切换仍可在当前页面使用，本地偏好保存失败不阻断创作。
  }
}

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark";
}

function createThemeConfig(mode: ResolvedAppearanceMode): ThemeConfig {
  const palette = appearancePalette[mode];
  const darkMode = mode === "dark";

  return {
    algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: palette.primary,
      colorInfo: palette.primary,
      colorSuccess: palette.success,
      colorWarning: palette.warning,
      colorError: palette.danger,
      colorText: palette.ink,
      colorTextSecondary: palette.muted,
      colorBorder: palette.border,
      colorBgBase: palette.canvas,
      colorBgContainer: palette.surface,
      colorBgElevated: palette.glassFallback,
      colorFillTertiary: palette.surfaceSoft,
      colorTextLightSolid: palette.onPrimary,
      borderRadius: 14,
      borderRadiusLG: 20,
      controlHeight: 44,
      motionDurationFast: "0.14s",
      motionDurationMid: "0.22s",
      motionDurationSlow: "0.34s",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
    },
    components: {
      Button: { fontWeight: 600 },
      Drawer: { colorBgElevated: palette.glassFallback },
      Segmented: {
        trackBg: palette.surfaceSoft,
        trackPadding: 4,
        itemColor: palette.muted,
        itemHoverColor: palette.ink,
        itemHoverBg: palette.primarySoft,
        itemActiveBg: palette.primarySoftHover,
        itemSelectedBg: palette.primarySoftHover,
        itemSelectedColor: palette.primary,
      },
      Select: {
        selectorBg: palette.surfaceSoft,
        hoverBorderColor: palette.primary,
        activeBorderColor: palette.primary,
        activeOutlineColor: palette.primarySoftHover,
        optionActiveBg: palette.primarySoft,
        optionSelectedBg: palette.primarySoftHover,
        optionSelectedColor: palette.primary,
        optionSelectedFontWeight: 600,
      },
      Input: {
        activeShadow: darkMode
          ? "0 0 0 3px rgba(82, 168, 255, 0.30)"
          : "0 0 0 3px rgba(0, 103, 217, 0.24)",
      },
    },
  };
}

const styles = stylex.create({
  root: {
    minWidth: "320px",
    minHeight: "100dvh",
  },
});
