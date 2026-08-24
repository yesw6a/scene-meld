import type { CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";

const desktopChromeHeight = 42;
const desktopFeedbackGap = 12;

export const desktopChrome = stylex.defineConsts({
  height: `${desktopChromeHeight}px`,
  feedbackTop: desktopChromeHeight + desktopFeedbackGap,
  floatingNoticeLayer: 950,
  overlayCeiling: 2100,
  chromeLayer: 2200,
  accessibilityLayer: 2300,
});

export const desktopDrawerOverlayStyles = {
  mask: {
    top: desktopChrome.height,
  },
  wrapper: {
    top: desktopChrome.height,
    height: `calc(100% - ${desktopChrome.height})`,
  },
} satisfies {
  mask: CSSProperties;
  wrapper: CSSProperties;
};

export const desktopModalOverlayStyles = {
  mask: {
    top: desktopChrome.height,
  },
  wrapper: {
    top: desktopChrome.height,
    height: `calc(100% - ${desktopChrome.height})`,
  },
} satisfies {
  mask: CSSProperties;
  wrapper: CSSProperties;
};
