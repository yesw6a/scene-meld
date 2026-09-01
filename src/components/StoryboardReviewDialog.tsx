import { useEffect, useState, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Alert, Input, Modal, Steps, Typography } from "antd";
import { Clapperboard } from "lucide-react";

import { isDesktopRuntime } from "../lib/runtime";
import { desktopChrome } from "../styles/desktop-chrome.stylex";
import { colors, radii } from "../styles/tokens.stylex";
import type { StoryboardPlan } from "../types";

interface StoryboardReviewDialogProps {
  plan: StoryboardPlan | null;
  onCancel: () => void;
  onConfirm: (plan: StoryboardPlan) => void;
}

export default function StoryboardReviewDialog({
  plan,
  onCancel,
  onConfirm,
}: StoryboardReviewDialogProps) {
  const [draft, setDraft] = useState<StoryboardPlan | null>(null);

  useEffect(() => {
    setDraft(plan ? { ...plan, shots: plan.shots.map((shot) => ({ ...shot })) } : null);
  }, [plan]);

  const canConfirm = Boolean(
    draft?.shots.length &&
      draft.shots.every((shot) => shot.title.trim() && shot.imagePrompt.trim()),
  );

  return (
    <Modal
      title={
        <span {...stylex.props(styles.title)}>
          <Clapperboard size={18} aria-hidden="true" />
          确认分镜方案
        </span>
      }
      open={Boolean(plan)}
      width="min(760px, calc(100vw - 32px))"
      style={MODAL_STYLE}
      styles={isDesktopRuntime() ? DESKTOP_MODAL_STYLES : MODAL_STYLES}
      okText={`开始生成 ${draft?.shots.length ?? 0} 张分镜图`}
      cancelText="返回提示词"
      okButtonProps={{ disabled: !canConfirm, className: "studio-dialog-action" }}
      cancelButtonProps={{ className: "studio-dialog-action" }}
      maskClosable={false}
      destroyOnHidden
      onCancel={onCancel}
      onOk={() => {
        if (draft && canConfirm) onConfirm(draft);
      }}
    >
      {draft ? (
        <div {...stylex.props(styles.content)}>
          <Steps
            size="small"
            current={0}
            responsive={false}
            items={[
              { title: "规划", description: "检查并修改镜头" },
              { title: "生成", description: "确认后才会请求图片" },
            ]}
          />

          <Alert
            type="info"
            showIcon
            message="现在还没有开始生成图片"
            description="请逐个检查镜头标题和画面描述。点击“开始生成”后，每个镜头会生成 1 张图；返回提示词不会丢失当前输入。"
          />

          <section aria-labelledby="storyboard-style-heading" {...stylex.props(styles.styleSection)}>
            <Typography.Text id="storyboard-style-heading" strong>
              统一视觉设定
            </Typography.Text>
            <Typography.Paragraph type="secondary" {...stylex.props(styles.styleCopy)}>
              {draft.styleBible || "未提供额外视觉设定，将以每个镜头的画面描述为准。"}
            </Typography.Paragraph>
          </section>

          <div {...stylex.props(styles.shotList)}>
            {draft.shots.map((shot, index) => (
              <section
                key={shot.id}
                aria-labelledby={`storyboard-shot-${shot.id}`}
                {...stylex.props(styles.shot)}
              >
                <div {...stylex.props(styles.shotHeading)}>
                  <span {...stylex.props(styles.shotNumber)}>{index + 1}</span>
                  <Typography.Text id={`storyboard-shot-${shot.id}`} strong>
                    镜头 {index + 1}
                  </Typography.Text>
                </div>

                <label {...stylex.props(styles.field)}>
                  <span {...stylex.props(styles.label)}>镜头标题</span>
                  <Input
                    value={shot.title}
                    maxLength={80}
                    aria-label={`镜头 ${index + 1} 标题`}
                    className="studio-storyboard-input"
                    onChange={(event) =>
                      setDraft((current) =>
                        updateShot(current, index, { title: event.target.value }),
                      )
                    }
                  />
                </label>

                <label {...stylex.props(styles.field)}>
                  <span {...stylex.props(styles.label)}>画面描述</span>
                  <Input.TextArea
                    value={shot.imagePrompt}
                    autoSize={{ minRows: 3, maxRows: 7 }}
                    maxLength={2_000}
                    showCount
                    aria-label={`镜头 ${index + 1} 画面描述`}
                    onChange={(event) =>
                      setDraft((current) =>
                        updateShot(current, index, { imagePrompt: event.target.value }),
                      )
                    }
                  />
                </label>
              </section>
            ))}
          </div>

          {!canConfirm ? (
            <Typography.Text type="danger" role="alert">
              每个镜头都需要填写标题和画面描述，补全后才能开始生成。
            </Typography.Text>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function updateShot(
  plan: StoryboardPlan | null,
  index: number,
  patch: Partial<StoryboardPlan["shots"][number]>,
): StoryboardPlan | null {
  if (!plan) return plan;
  return {
    ...plan,
    shots: plan.shots.map((shot, shotIndex) =>
      shotIndex === index ? { ...shot, ...patch } : shot,
    ),
  };
}

const styles = stylex.create({
  title: { display: "inline-flex", alignItems: "center", gap: "8px", color: colors.ink },
  content: { display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" },
  styleSection: {
    padding: "12px 14px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  styleCopy: { marginTop: "4px", marginBottom: 0, lineHeight: 1.6 },
  shotList: { display: "flex", flexDirection: "column", gap: "12px" },
  shot: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "14px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
  },
  shotHeading: { display: "flex", alignItems: "center", gap: "8px" },
  shotNumber: {
    width: "28px",
    height: "28px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { color: colors.body, fontSize: "13px", fontWeight: 600 },
});

const MODAL_STYLE: CSSProperties = { top: "16px" };

const MODAL_STYLES = {
  container: {
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100dvh - 32px)",
    overflow: "hidden",
  } satisfies CSSProperties,
  body: { flex: "1 1 auto", minHeight: 0, overflowY: "auto" } satisfies CSSProperties,
  footer: { flexShrink: 0 } satisfies CSSProperties,
};

const DESKTOP_MODAL_STYLES = {
  ...MODAL_STYLES,
  container: {
    ...MODAL_STYLES.container,
    maxHeight: `calc(100dvh - ${desktopChrome.height} - 32px)`,
  } satisfies CSSProperties,
};
