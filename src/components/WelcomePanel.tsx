import * as stylex from "@stylexjs/stylex";
import { Prompts } from "@ant-design/x";
import { Camera, LayoutTemplate, Sparkles, WandSparkles } from "lucide-react";

import { colors, materials, motion, radii, shadows } from "../styles/tokens.stylex";

interface WelcomePanelProps {
  configured: boolean;
  onChoosePrompt: (prompt: string) => void;
  onOpenSettings: () => void;
}

export default function WelcomePanel({
  configured,
  onChoosePrompt,
  onOpenSettings,
}: WelcomePanelProps) {
  return (
    <section {...stylex.props(styles.root)} aria-labelledby="welcome-title">
      <div {...stylex.props(styles.eyebrow)}>
        <Sparkles size={15} aria-hidden="true" />
        对话式图片创作
      </div>
      <h1 id="welcome-title" {...stylex.props(styles.title)}>
        把脑海里的画面，
        <span {...stylex.props(styles.titleLine)}>清楚地说出来。</span>
      </h1>
      <p {...stylex.props(styles.copy)}>
        每条消息都会生成一张独立图片。你可以再次生成，或把上一条提示词带回输入框继续修改。
      </p>

      {!configured ? (
        <button type="button" {...stylex.props(styles.configureButton)} onClick={onOpenSettings}>
          配置 API 基础地址与 API Key
        </button>
      ) : null}

      <Prompts
        title="从一个方向开始"
        wrap
        items={PROMPT_ITEMS}
        className={stylex.props(styles.prompts).className}
        classNames={{ item: stylex.props(styles.promptItem).className }}
        onItemClick={({ data }) => {
          if (typeof data.description === "string") {
            onChoosePrompt(data.description);
          }
        }}
      />

      <div {...stylex.props(styles.note)}>
        <WandSparkles size={17} aria-hidden="true" />
        <span>建议写清楚主体、环境、构图、光线、材质与画面比例。</span>
      </div>
    </section>
  );
}

const PROMPT_ITEMS = [
  {
    key: "product",
    icon: <Camera size={18} aria-hidden="true" />,
    label: "产品摄影",
    description:
      "一只磨砂银色智能手表悬浮在深灰摄影棚中，侧后方柔光勾勒金属边缘，微距产品摄影，克制高级，方形构图",
  },
  {
    key: "poster",
    icon: <LayoutTemplate size={18} aria-hidden="true" />,
    label: "概念海报",
    description:
      "未来城市公共交通主题概念海报，巨大的圆形站台与薄雾中的人群，冷暖对比光，建筑摄影感，纵向构图，不要文字",
  },
  {
    key: "story",
    icon: <Sparkles size={18} aria-hidden="true" />,
    label: "叙事场景",
    description:
      "雨夜旧书店即将打烊，店员站在暖色窗边整理最后一本书，街道倒影延伸至远处，电影静帧，35mm 胶片质感，横向构图",
  },
];

const styles = stylex.create({
  root: {
    width: "min(1120px, 100%)",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "56px 24px",
    margin: "0 auto",
    "@media (max-width: 767px)": {
      padding: "36px 18px",
    },
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    color: colors.primary,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "18px 0 16px",
    color: colors.ink,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
    fontSize: "clamp(38px, 5.6vw, 58px)",
    fontWeight: 600,
    lineHeight: 1.06,
    letterSpacing: "-0.035em",
  },
  titleLine: {
    display: "block",
    color: colors.primary,
  },
  copy: {
    maxWidth: "720px",
    margin: "0 0 24px",
    color: colors.body,
    fontSize: "16px",
    lineHeight: 1.7,
  },
  configureButton: {
    minHeight: "46px",
    padding: "0 18px",
    marginBottom: "28px",
    color: colors.onPrimary,
    fontWeight: 700,
    backgroundColor: colors.primary,
    borderWidth: 0,
    borderRadius: radii.pill,
    cursor: "pointer",
    boxShadow: shadows.subtle,
    transitionProperty: "background-color, box-shadow, transform",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      backgroundColor: colors.primaryHover,
      boxShadow: shadows.interactive,
      transform: "translateY(-1px)",
    },
    ":active": {
      backgroundColor: colors.primaryPressed,
      boxShadow: shadows.subtle,
      transform: "scale(0.98)",
    },
    ":focus-visible": {
      outlineWidth: "3px",
      outlineStyle: "solid",
      outlineColor: colors.primarySoft,
      outlineOffset: "2px",
      boxShadow: shadows.focus,
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  prompts: {
    width: "100%",
    marginTop: "8px",
  },
  promptItem: {
    minHeight: "48px",
    backgroundColor: colors.glassSubtle,
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
    cursor: "pointer",
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
    transitionProperty: "color, background-color, border-color, box-shadow, transform",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderColor: colors.primarySoftHover,
      boxShadow: shadows.subtle,
      transform: "translateY(-1px)",
    },
    ":active": {
      color: colors.primaryPressed,
      backgroundColor: colors.primarySoftHover,
      transform: "scale(0.99)",
    },
    ":focus-visible": {
      borderColor: colors.primary,
      boxShadow: shadows.focus,
      outline: "none",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  note: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginTop: "24px",
    padding: "12px 14px",
    color: colors.muted,
    fontSize: "13px",
    lineHeight: 1.5,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
  },
});
