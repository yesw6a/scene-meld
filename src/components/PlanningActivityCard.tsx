import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button } from "antd";
import {
  BrainCircuit,
  CircleCheck,
  LoaderCircle,
  Square,
} from "lucide-react";

import type { PlanningActivity, PlanningActivityPhase } from "../types";
import { colors, motion, radii } from "../styles/tokens.stylex";

interface PlanningActivityCardProps {
  activity: PlanningActivity;
  onCancel: () => void;
}

const STORYBOARD_PHASES: PlanningActivityPhase[] = [
  "preparing",
  "waiting",
  "receiving",
  "validating",
  "reviewing",
];

const IMAGE_PHASES: PlanningActivityPhase[] = [
  "preparing",
  "waiting",
  "receiving",
  "validating",
  "completed",
];

export default function PlanningActivityCard({
  activity,
  onCancel,
}: PlanningActivityCardProps) {
  const elapsedSeconds = useElapsedSeconds(activity.startedAt);
  const phases = activity.mode === "storyboard" ? STORYBOARD_PHASES : IMAGE_PHASES;
  const activeIndex = phases.indexOf(activity.phase);
  const targetLabel = activity.mode === "storyboard"
    ? `${activity.targetCount} 个镜头`
    : activity.mode === "batch"
      ? `${activity.targetCount} 张图片提示词`
      : "1 张图片提示词";

  return (
    <section
      {...stylex.props(styles.root)}
      aria-label="AI 规划进度"
      aria-live="off"
    >
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.icon)}>
          <BrainCircuit size={19} aria-hidden="true" />
        </span>
        <div {...stylex.props(styles.heading)}>
          <strong>
            {activity.phase === "reviewing"
              ? "规划方案等待确认"
              : activity.phase === "completed"
                ? "AI 规划已完成"
                : "AI 正在规划"}
          </strong>
          <span {...stylex.props(styles.headingMeta)}>
            {`${activity.model} · ${targetLabel} · 任务进行 ${formatElapsed(elapsedSeconds)}`}
          </span>
        </div>
        <Button
          size="small"
          className={stylex.props(styles.cancelButton).className}
          icon={<Square size={13} fill="currentColor" aria-hidden="true" />}
          onClick={onCancel}
        >
          {activity.phase === "reviewing"
            ? "取消生成"
            : activity.phase === "completed"
              ? "停止生成"
              : "停止"}
        </Button>
      </div>

      <ol {...stylex.props(styles.steps)}>
        {phases.map((phase, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          const terminalComplete = active && phase === "completed";
          return (
            <li
              key={phase}
              {...stylex.props(styles.step, active && styles.stepActive)}
              aria-current={active ? "step" : undefined}
            >
              <span {...stylex.props(styles.stepIcon)}>
                {completed || terminalComplete ? (
                  <CircleCheck size={15} aria-hidden="true" />
                ) : active ? (
                  <span {...stylex.props(styles.stepSpinner)}>
                    <LoaderCircle size={15} aria-hidden="true" />
                  </span>
                ) : (
                  <span {...stylex.props(styles.stepDot)} aria-hidden="true" />
                )}
              </span>
              <span>{phaseLabel(phase)}</span>
            </li>
          );
        })}
      </ol>

      <div {...stylex.props(styles.detail)} aria-live="polite" aria-atomic="true">
        <span>{phaseDetail(activity)}</span>
        {activity.phase === "waiting" && elapsedSeconds >= 30 ? (
          <span>
            {activity.mode === "storyboard"
              ? "复杂故事可能需要 1–3 分钟，请保持窗口打开。"
              : "复杂创作可能需要一些时间，请保持窗口打开。"}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function useElapsedSeconds(startedAt: number): number {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return seconds;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function phaseLabel(phase: PlanningActivityPhase): string {
  if (phase === "preparing") return "准备提示词与参考图";
  if (phase === "waiting") return "等待模型开始返回";
  if (phase === "receiving") return "接收规划内容";
  if (phase === "validating") return "校验规划结构";
  if (phase === "reviewing") return "等待确认规划方案";
  return "规划完成";
}

function phaseDetail(activity: PlanningActivity): string {
  if (activity.phase === "preparing") return "正在整理本次规划需要的文字和图片。";
  if (activity.phase === "waiting") {
    return activity.nonStreaming
      ? "该连接会在完成后一次性返回，正在继续等待。"
      : "请求已发送，正在等待模型返回第一段内容。";
  }
  if (activity.phase === "receiving") {
    if (activity.nonStreaming && activity.receivedChars === 0) {
      return "已经收到上游响应，正在等待并读取完整规划结果。";
    }
    return activity.receivedChars > 0
      ? `模型已开始返回，当前已接收 ${activity.receivedChars.toLocaleString("zh-CN")} 个字符。`
      : "模型已开始返回规划内容。";
  }
  if (activity.phase === "validating") {
    return activity.mode === "storyboard"
      ? "正在检查角色、场景、镜头数量和结构是否完整。"
      : "正在检查提示词数量、结构和内容是否完整。";
  }
  if (activity.phase === "reviewing") {
    return "规划已经完成，请在确认窗口中检查后再开始生成。";
  }
  return "规划阶段已经完成，正在使用规划结果生成图片。";
}

const spin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

const styles = stylex.create({
  root: {
    width: "min(720px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "14px",
    color: colors.body,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
  },
  header: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "10px",
  },
  cancelButton: {
    minHeight: "32px",
    "@media (pointer: coarse)": {
      minHeight: "44px",
    },
  },
  icon: {
    width: "34px",
    height: "34px",
    display: "grid",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.medium,
    placeItems: "center",
  },
  heading: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    color: colors.ink,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  headingMeta: {
    color: colors.muted,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
  },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "6px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  step: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 8px",
    color: colors.subtle,
    fontSize: "11px",
    lineHeight: 1.35,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.small,
  },
  stepActive: {
    color: colors.ink,
    backgroundColor: colors.primarySoft,
  },
  stepIcon: {
    width: "16px",
    height: "16px",
    flex: "0 0 auto",
    display: "grid",
    color: colors.primary,
    placeItems: "center",
  },
  stepSpinner: {
    display: "grid",
    placeItems: "center",
    animationName: spin,
    animationDuration: "900ms",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  stepDot: {
    width: "6px",
    height: "6px",
    backgroundColor: colors.borderStrong,
    borderRadius: "50%",
  },
  detail: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    color: colors.muted,
    fontSize: "12px",
    lineHeight: 1.5,
    transitionProperty: "color",
    transitionDuration: motion.standard,
  },
});
