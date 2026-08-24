import { useEffect, useState, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Alert, Input, Modal, Tag, Typography } from "antd";
import { ShieldAlert, ShieldCheck, WandSparkles } from "lucide-react";

import { isDesktopRuntime } from "../lib/runtime";
import { desktopChrome } from "../styles/desktop-chrome.stylex";
import type { PromptOptimizationResult } from "../types";
import { colors, radii } from "../styles/tokens.stylex";
import PromptEditorSizeControl, {
  type PromptEditorSizeMode,
} from "./PromptEditorSizeControl";

interface PromptOptimizationDialogProps {
  open: boolean;
  originalPrompt: string;
  result: PromptOptimizationResult | null;
  onClose: () => void;
  onApply: (value: string) => void;
}

export default function PromptOptimizationDialog({
  open,
  originalPrompt,
  result,
  onClose,
  onApply,
}: PromptOptimizationDialogProps) {
  const [value, setValue] = useState("");
  const [sizeMode, setSizeMode] = useState<PromptEditorSizeMode>("normal");

  useEffect(() => {
    if (open) setValue(result?.optimizedPrompt ?? "");
  }, [open, result]);

  const risk = result?.riskLevel ?? "none";
  const canApply = risk !== "blocked" && Boolean(value.trim());
  const status = {
    none: { label: "已优化", color: "blue", alert: "info" as const },
    review: { label: "已安全调整", color: "orange", alert: "warning" as const },
    blocked: { label: "未通过安全复检", color: "red", alert: "error" as const },
  }[risk];

  return (
    <Modal
      title={
        <span {...stylex.props(styles.title)}>
          <WandSparkles size={18} aria-hidden="true" />
          优化提示词
        </span>
      }
      open={open}
      width="min(680px, calc(100vw - 32px))"
      style={MODAL_STYLE}
      styles={isDesktopRuntime() ? DESKTOP_MODAL_STYLES : MODAL_STYLES}
      okText={risk === "blocked" ? "无法替换" : "替换输入框"}
      cancelText="保留原文"
      okButtonProps={{ disabled: !canApply }}
      onOk={() => canApply && onApply(value.trim())}
      onCancel={onClose}
      destroyOnHidden
    >
      {result ? (
        <div {...stylex.props(styles.content)}>
          <Alert
            type={status.alert}
            showIcon
            message={
              <span {...stylex.props(styles.statusRow)}>
                <Tag color={status.color}>{status.label}</Tag>
                <span>{result.notice || defaultNotice(risk)}</span>
              </span>
            }
          />

          <section {...stylex.props(styles.section)} aria-labelledby="original-prompt-heading">
            <Typography.Text id="original-prompt-heading" strong>原提示词</Typography.Text>
            <div {...stylex.props(styles.originalPrompt)}>{originalPrompt}</div>
          </section>

          <section
            {...stylex.props(styles.section, styles.optimizedSection)}
            aria-labelledby="optimized-prompt-heading"
          >
            <span {...stylex.props(styles.sectionHeading)}>
              <Typography.Text id="optimized-prompt-heading" strong>优化结果</Typography.Text>
              <span {...stylex.props(styles.sectionActions)}>
                <Typography.Text type="secondary">
                  {risk === "blocked" ? "仅供查看，不能替换" : "可在替换前继续编辑"}
                </Typography.Text>
                <PromptEditorSizeControl
                  value={sizeMode}
                  label="优化结果输入框"
                  onChange={setSizeMode}
                />
              </span>
            </span>
            <Input.TextArea
              value={value}
              autoSize={DIALOG_AUTO_SIZE[sizeMode]}
              styles={sizeMode === "expanded" ? EXPANDED_TEXTAREA_STYLES : undefined}
              maxLength={20_000}
              showCount
              readOnly={risk === "blocked"}
              aria-label="优化后的提示词"
              onChange={(event) => setValue(event.target.value)}
            />
          </section>

          {result.safetyFindings?.length ? (
            <section
              {...stylex.props(styles.section, styles.findingPanel)}
              aria-labelledby="optimization-findings-heading"
            >
              <span {...stylex.props(styles.findingHeading)}>
                <ShieldAlert size={16} aria-hidden="true" />
                <Typography.Text id="optimization-findings-heading" strong>安全复检</Typography.Text>
              </span>
              <ul {...stylex.props(styles.changeList)}>
                {result.safetyFindings.map((finding) => <li key={finding}>{finding}</li>)}
              </ul>
            </section>
          ) : null}

          {result.changes.length ? (
            <section {...stylex.props(styles.section, styles.changePanel)} aria-labelledby="optimization-changes-heading">
              <span {...stylex.props(styles.changeHeading)}>
                <ShieldCheck size={16} aria-hidden="true" />
                <Typography.Text id="optimization-changes-heading" strong>本次调整</Typography.Text>
              </span>
              <ul {...stylex.props(styles.changeList)}>
                {result.changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            </section>
          ) : null}

          <Typography.Text type="secondary" {...stylex.props(styles.disclaimer)}>
            优化结果不会自动发送；目标 Endpoint 仍会按其自身规则审核内容。
          </Typography.Text>
        </div>
      ) : null}
    </Modal>
  );
}

function defaultNotice(risk: PromptOptimizationResult["riskLevel"]): string {
  if (risk === "review") return "已保留合法创作意图，并对高风险细节作出透明调整。";
  if (risk === "blocked") return "结果仍包含无法安全保留的内容，不能替换输入框，请修改创作方向。";
  return "已补充画面结构和视觉细节，请确认后再替换输入框。";
}

const styles = stylex.create({
  title: { display: "inline-flex", alignItems: "center", gap: "8px", color: colors.ink },
  content: { display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" },
  statusRow: { display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "6px" },
  section: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
  optimizedSection: { paddingBottom: "8px" },
  sectionHeading: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" },
  sectionActions: { display: "inline-flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "10px" },
  originalPrompt: { maxHeight: "108px", overflowY: "auto", padding: "10px 12px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: colors.body, backgroundColor: colors.glassSubtle, borderWidth: "1px", borderStyle: "solid", borderColor: colors.glassBorder, borderRadius: radii.medium, lineHeight: 1.6 },
  changePanel: { padding: "11px 12px", backgroundColor: colors.glassSubtle, borderWidth: "1px", borderStyle: "solid", borderColor: colors.glassBorder, borderRadius: radii.medium },
  changeHeading: { display: "flex", alignItems: "center", gap: "7px", color: colors.primary },
  findingPanel: { padding: "11px 12px", backgroundColor: colors.warningSoft, borderWidth: "1px", borderStyle: "solid", borderColor: colors.warning, borderRadius: radii.medium },
  findingHeading: { display: "flex", alignItems: "center", gap: "7px", color: colors.warning },
  changeList: { margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px", color: colors.body, lineHeight: 1.55 },
  disclaimer: { fontSize: "12px", lineHeight: 1.5 },
});

const DIALOG_AUTO_SIZE: Record<PromptEditorSizeMode, false | { minRows: number; maxRows: number }> = {
  compact: { minRows: 2, maxRows: 2 },
  normal: { minRows: 7, maxRows: 7 },
  expanded: false,
};

const EXPANDED_TEXTAREA_HEIGHT = "clamp(240px, 44dvh, 480px)";

const EXPANDED_TEXTAREA_STYLES = {
  textarea: {
    height: EXPANDED_TEXTAREA_HEIGHT,
    minHeight: EXPANDED_TEXTAREA_HEIGHT,
    maxHeight: EXPANDED_TEXTAREA_HEIGHT,
    overflowY: "auto",
    resize: "none",
  } satisfies CSSProperties,
};

const MODAL_STYLE: CSSProperties = {
  top: "16px",
};

const MODAL_STYLES = {
  container: {
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100dvh - 32px)",
    overflow: "hidden",
  } satisfies CSSProperties,
  header: {
    flexShrink: 0,
  } satisfies CSSProperties,
  body: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
  } satisfies CSSProperties,
  footer: {
    flexShrink: 0,
  } satisfies CSSProperties,
};

const DESKTOP_MODAL_STYLES = {
  ...MODAL_STYLES,
  container: {
    ...MODAL_STYLES.container,
    maxHeight: `calc(100dvh - ${desktopChrome.height} - 32px)`,
  } satisfies CSSProperties,
};
