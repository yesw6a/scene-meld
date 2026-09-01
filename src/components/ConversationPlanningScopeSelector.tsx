import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { Checkbox } from "antd";
import { Clapperboard, Image as ImageIcon, Images } from "lucide-react";

import type { ConversationPlanningScopes } from "../types";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";

interface ConversationPlanningScopeSelectorProps {
  scopes: ConversationPlanningScopes;
  hasUnsavedChanges: boolean;
  onChange: (scope: keyof ConversationPlanningScopes, checked: boolean) => void;
}

export default function ConversationPlanningScopeSelector({
  scopes,
  hasUnsavedChanges,
  onChange,
}: ConversationPlanningScopeSelectorProps) {
  const enabledLabels = [
    scopes.single ? "单图生成" : "",
    scopes.batch ? "多图生成" : "",
    scopes.storyboard ? "分镜生成" : "",
  ].filter(Boolean);
  const statusCopy = hasUnsavedChanges ? "保存设置后生效。" : "当前设置已生效。";

  return (
    <fieldset {...stylex.props(styles.fieldset)}>
      <legend {...stylex.props(styles.legend)}>AI 规划适用场景</legend>
      <p {...stylex.props(styles.intro)}>
        选择哪些生成模式会在生图前调用当前 AI 规划模型；未勾选的模式会直接交给 gpt-image-2。手动提示词优化不受这里影响。
      </p>
      <div {...stylex.props(styles.options)}>
        <PlanningScopeOption
          checked={scopes.single}
          icon={<ImageIcon size={16} aria-hidden="true" />}
          title="单图生成"
          description="生成前调用一次，规划一条完整生图提示词。"
          onChange={(checked) => onChange("single", checked)}
        />
        <PlanningScopeOption
          checked={scopes.batch}
          icon={<Images size={16} aria-hidden="true" />}
          title="多图生成"
          description="整批只调用一次，按生成数量规划差异化提示词。"
          onChange={(checked) => onChange("batch", checked)}
        />
        <PlanningScopeOption
          checked={scopes.storyboard}
          icon={<Clapperboard size={16} aria-hidden="true" />}
          title="分镜生成"
          description="调用一次，规划前后连续的镜头；关闭后使用内置模板。"
          badge="默认"
          onChange={(checked) => onChange("storyboard", checked)}
        />
      </div>
      <div
        aria-live="polite"
        {...stylex.props(styles.summary, !enabledLabels.length && styles.summaryMuted)}
      >
        {enabledLabels.length
          ? `当前 AI 自动规划：${enabledLabels.join("、")}。${statusCopy}`
          : `自动 AI 规划已全部关闭；三种模式都会直接生图。${statusCopy}`}
      </div>
    </fieldset>
  );
}

function PlanningScopeOption({
  checked,
  icon,
  title,
  description,
  badge,
  onChange,
}: {
  checked: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      {...stylex.props(styles.option, checked && styles.optionActive)}
    >
      <span {...stylex.props(styles.optionCopy)}>
        <span {...stylex.props(styles.optionTitle)}>
          {icon}
          <strong>{title}</strong>
          {badge ? <small {...stylex.props(styles.defaultBadge)}>{badge}</small> : null}
        </span>
        <small>{description}</small>
      </span>
    </Checkbox>
  );
}

const styles = stylex.create({
  fieldset: { minWidth: 0, padding: 0, margin: 0, borderWidth: 0 },
  legend: {
    padding: 0,
    marginBottom: "8px",
    color: colors.ink,
    fontSize: "13px",
    fontWeight: 600,
  },
  intro: {
    marginTop: 0,
    marginBottom: "10px",
    color: colors.muted,
    fontSize: "13px",
    lineHeight: 1.55,
  },
  options: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    "@media (max-width: 680px)": { gridTemplateColumns: "1fr" },
  },
  option: {
    width: "100%",
    minWidth: 0,
    minHeight: "94px",
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    padding: "12px",
    boxSizing: "border-box",
    whiteSpace: "normal",
    color: colors.ink,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
    cursor: "pointer",
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": { backgroundColor: colors.primarySoft },
    ":focus-within": { boxShadow: shadows.focus },
  },
  optionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    boxShadow: `inset 0 0 0 1px ${colors.primary}`,
  },
  optionCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    color: colors.ink,
    lineHeight: 1.45,
  },
  optionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: colors.primary,
  },
  defaultBadge: {
    padding: "1px 6px",
    color: colors.primary,
    fontSize: "11px",
    fontWeight: 600,
    backgroundColor: colors.primarySoftHover,
    borderRadius: radii.pill,
  },
  summary: {
    marginTop: "8px",
    padding: "8px 10px",
    color: colors.primary,
    fontSize: "12px",
    lineHeight: 1.5,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.small,
  },
  summaryMuted: { color: colors.muted, backgroundColor: colors.glassSubtle },
});
