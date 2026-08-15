import * as stylex from "@stylexjs/stylex";

interface BrandMarkProps {
  size?: number;
  title?: string;
  animated?: boolean;
}

export default function BrandMark({
  size = 24,
  title,
  animated = false,
}: BrandMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? title : undefined}
      focusable="false"
    >
      <path
        d="M34 13H21a8 8 0 0 0-8 8v22a8 8 0 0 0 8 8h13"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...stylex.props(animated && styles.frameLeft)}
      />
      <path
        d="M30 51h13a8 8 0 0 0 8-8V21a8 8 0 0 0-8-8H30"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...stylex.props(animated && styles.frameRight)}
      />
    </svg>
  );
}

const alignLeft = stylex.keyframes({
  from: { transform: "translate(2px, -1px)", opacity: 0.72 },
  to: { transform: "translate(0, 0)", opacity: 1 },
});

const alignRight = stylex.keyframes({
  from: { transform: "translate(-2px, 1px)", opacity: 0.72 },
  to: { transform: "translate(0, 0)", opacity: 1 },
});

const styles = stylex.create({
  frameLeft: {
    animationName: alignLeft,
    animationDuration: "360ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transformOrigin: "center",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  frameRight: {
    animationName: alignRight,
    animationDuration: "360ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transformOrigin: "center",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
});
