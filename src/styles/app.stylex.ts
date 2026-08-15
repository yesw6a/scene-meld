import * as stylex from "@stylexjs/stylex";

import { desktopChrome } from "./desktop-chrome.stylex";
import { colors } from "./tokens.stylex";

export const appStyles = stylex.create({
  loadingShell: {
    minWidth: "320px",
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "14px",
    color: colors.muted,
    backgroundColor: colors.canvas,
  },
  app: {
    minWidth: "320px",
    minHeight: "100dvh",
    height: "100dvh",
    boxSizing: "border-box",
    display: "flex",
    color: colors.ink,
    background: colors.canvasAmbient,
  },
  desktopApp: {
    paddingTop: desktopChrome.height,
  },
  main: {
    minWidth: 0,
    height: "100%",
    boxSizing: "border-box",
    flex: 1,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    gap: "10px",
    padding: "12px",
    overflow: "hidden",
    outline: "none",
  },
  mainHeader: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  conversationPane: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarGutter: "stable",
  },
  conversationPaneEmpty: {
    scrollbarGutter: "auto",
  },
});
