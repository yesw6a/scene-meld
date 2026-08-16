import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";

import { imageSizeLabel } from "../lib/image-sizes";
import type { AssistantMessage } from "../types";
import { colors, motion, radii } from "../styles/tokens.stylex";

interface BatchImageGridProps {
  messages: AssistantMessage[];
  renderTile: (message: AssistantMessage, index: number) => ReactNode;
  headerAction?: ReactNode;
}

export default function BatchImageGrid({
  messages,
  renderTile,
  headerAction,
}: BatchImageGridProps) {
  const completedCount = messages.filter((message) => message.status === "success").length;
  const pendingCount = messages.filter((message) => message.status === "loading").length;
  const matchedCount = messages.filter(
    (message) => message.status === "success" && message.aspectStatus === "matched",
  ).length;
  const unverifiedCount = messages.filter(
    (message) => message.status === "success" && message.aspectStatus === "unverified",
  ).length;
  const mismatchedCount = messages.filter(
    (message) => message.status === "success" && message.aspectStatus === "mismatched",
  ).length;
  const failedCount = messages.filter((message) => message.status === "error").length;
  const abortedCount = messages.filter((message) => message.status === "aborted").length;
  const request = messages[0]?.request;
  const statusLabel = batchStatusLabel({
    total: messages.length,
    completedCount,
    pendingCount,
    matchedCount,
    unverifiedCount,
    mismatchedCount,
    failedCount,
    abortedCount,
  });

  return (
    <div {...stylex.props(styles.root)} aria-label="批量生成结果">
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerCopy)}>
          <span {...stylex.props(styles.title)}>批量结果</span>
          {request ? (
            <span {...stylex.props(styles.meta)}>
              <span>{request.model}</span>
              <span>{imageSizeLabel(request.size)}</span>
              <span>{qualityLabel(request.quality)}</span>
            </span>
          ) : null}
        </div>
        <div {...stylex.props(styles.headerControls)}>
          <span {...stylex.props(styles.status)} aria-live="polite" aria-atomic="true">
            {statusLabel}
          </span>
          {headerAction ? (
            <span {...stylex.props(styles.headerAction)}>{headerAction}</span>
          ) : null}
        </div>
      </div>
      <div {...stylex.props(styles.grid, gridLayout(messages.length))}>
        {messages.map((message, index) => (
          <div key={message.id} {...stylex.props(styles.cell)}>
            {renderTile(message, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

function batchStatusLabel({
  total,
  completedCount,
  pendingCount,
  matchedCount,
  unverifiedCount,
  mismatchedCount,
  failedCount,
  abortedCount,
}: {
  total: number;
  completedCount: number;
  pendingCount: number;
  matchedCount: number;
  unverifiedCount: number;
  mismatchedCount: number;
  failedCount: number;
  abortedCount: number;
}): string {
  const fragments = [`${completedCount} / ${total} 已完成`];

  if (matchedCount) {
    fragments.push(`${matchedCount} 张符合比例`);
  }
  if (unverifiedCount) {
    fragments.push(`${unverifiedCount} 张尺寸未验证`);
  }
  if (pendingCount) {
    fragments.push(`${pendingCount} 张生成中`);
  }
  if (mismatchedCount) {
    fragments.push(`${mismatchedCount} 张比例不符`);
  }
  if (failedCount || abortedCount) {
    fragments.push(failureLabel(failedCount, abortedCount));
  }

  return fragments.join(" · ");
}

function failureLabel(failedCount: number, abortedCount: number): string {
  const fragments: string[] = [];

  if (failedCount) {
    fragments.push(`${failedCount} 张失败`);
  }
  if (abortedCount) {
    fragments.push(`${abortedCount} 张已停止`);
  }

  return fragments.join("，");
}

function qualityLabel(quality: AssistantMessage["request"]["quality"]): string {
  return { low: "低质量", medium: "中质量", high: "高质量" }[quality];
}

function gridLayout(count: number) {
  if (count <= 1) {
    return styles.gridOne;
  }
  if (count === 2) {
    return styles.gridTwo;
  }
  if (count === 3) {
    return styles.gridThree;
  }
  if (count === 4) {
    return styles.gridFour;
  }
  if (count === 5) {
    return styles.gridFive;
  }
  if (count === 6) {
    return styles.gridSix;
  }
  if (count === 7) {
    return styles.gridSeven;
  }
  if (count === 8) {
    return styles.gridEight;
  }

  return styles.gridNine;
}

const styles = stylex.create({
  root: {
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  header: {
    minHeight: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "0 2px",
    color: colors.muted,
    fontSize: "13px",
    "@media (max-width: 620px)": {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: "8px",
    },
  },
  headerCopy: {
    minWidth: 0,
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: "8px",
  },
  headerControls: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: "6px",
    "@media (max-width: 620px)": {
      width: "100%",
      justifyContent: "space-between",
    },
  },
  title: {
    color: colors.ink,
    fontWeight: 600,
  },
  meta: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    color: colors.subtle,
    fontSize: "12px",
  },
  status: {
    minWidth: 0,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    overflowWrap: "anywhere",
  },
  headerAction: {
    display: "flex",
    alignItems: "center",
  },
  grid: {
    width: "100%",
    minWidth: 0,
    display: "grid",
    alignItems: "start",
    gap: "16px 12px",
    padding: "12px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
    transitionProperty: "border-color, background-color",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    "@media (max-width: 620px)": {
      gap: "16px",
      padding: "10px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
    },
  },
  gridOne: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  gridTwo: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridThree: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridFour: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridFive: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    "@media (max-width: 920px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridSix: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    "@media (max-width: 920px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridSeven: {
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    "@media (max-width: 1320px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridEight: {
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    "@media (max-width: 1320px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  gridNine: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    "@media (max-width: 620px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  cell: {
    minWidth: 0,
  },
});
