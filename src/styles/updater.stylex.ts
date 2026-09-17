import * as stylex from "@stylexjs/stylex";

const rotate = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

export const updaterStyles = stylex.create({
  spinning: {
    display: "inline-flex",
    animationName: rotate,
    animationDuration: "1s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    animationPlayState: {
      default: "running",
      "@media (prefers-reduced-motion: reduce)": "paused",
    },
  },
  activity: { display: "flex", alignItems: "center", gap: "8px" },
});
