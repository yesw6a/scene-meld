import * as stylex from "@stylexjs/stylex";

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
    display: "flex",
    color: colors.ink,
    background: colors.canvasAmbient,
  },
  main: {
    minWidth: 0,
    height: "100dvh",
    flex: 1,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    gap: "10px",
    padding: "12px",
    overflow: "hidden",
    outline: "none",
  },
  conversationPane: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarGutter: "stable",
  },
});
