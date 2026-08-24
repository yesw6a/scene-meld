import * as stylex from "@stylexjs/stylex";
import { Button, Tooltip } from "antd";
import { Maximize2, Minimize2, Square } from "lucide-react";

import { colors, motion, radii, shadows } from "../styles/tokens.stylex";

export type PromptEditorSizeMode = "compact" | "normal" | "expanded";

interface PromptEditorSizeControlProps {
  value: PromptEditorSizeMode;
  label: string;
  onChange: (value: PromptEditorSizeMode) => void;
}

const OPTIONS = [
  { value: "compact", label: "最小", icon: Minimize2 },
  { value: "normal", label: "标准", icon: Square },
  { value: "expanded", label: "展开", icon: Maximize2 },
] satisfies Array<{
  value: PromptEditorSizeMode;
  label: string;
  icon: typeof Minimize2;
}>;

export default function PromptEditorSizeControl({
  value,
  label,
  onChange,
}: PromptEditorSizeControlProps) {
  return (
    <div role="group" aria-label={`${label}尺寸`} {...stylex.props(styles.group)}>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;

        return (
          <Tooltip key={option.value} title={`${option.label}尺寸`} placement="top">
            <Button
              type="text"
              size="small"
              icon={<Icon size={15} strokeWidth={1.8} aria-hidden="true" />}
              aria-label={`将${label}设为${option.label}尺寸`}
              aria-pressed={selected}
              {...stylex.props(styles.button, selected && styles.buttonSelected)}
              onClick={() => onChange(option.value)}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}

const styles = stylex.create({
  group: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    padding: "2px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  button: {
    width: "30px",
    minWidth: "30px",
    height: "28px",
    padding: 0,
    color: colors.muted,
    borderRadius: "10px",
    transitionProperty: "color, background-color, box-shadow",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.ink,
      backgroundColor: colors.surfaceSoft,
    },
    ":focus-visible": {
      boxShadow: shadows.focus,
    },
    "@media (pointer: coarse)": {
      width: "44px",
      minWidth: "44px",
      height: "44px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
    },
  },
  buttonSelected: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    ":hover": {
      color: colors.primaryHover,
      backgroundColor: colors.primarySoftHover,
    },
  },
});
