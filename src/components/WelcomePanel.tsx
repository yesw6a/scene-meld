import * as stylex from "@stylexjs/stylex";
import { Camera, CheckCircle2, Clapperboard, LayoutTemplate, SlidersHorizontal } from "lucide-react";

import BrandMark from "./BrandMark";
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
        <BrandMark size={15} />
        <span>SceneMeld · 图片创作</span>
      </div>

      <div {...stylex.props(styles.intro)}>
        <h1 id="welcome-title" {...stylex.props(styles.title)}>
          从一句话开始，<span {...stylex.props(styles.titleAccent)}>生成一张图。</span>
        </h1>
        <p {...stylex.props(styles.copy)}>
          写下画面、光线和材质，模型会根据提示词生成结果。也可以先选一个灵感方向，再回到输入框继续修改。
        </p>
      </div>

      <div {...stylex.props(styles.connectionCard, !configured && styles.connectionCardIncomplete)}>
        <span {...stylex.props(styles.connectionIcon)} aria-hidden="true">
          {configured ? <CheckCircle2 size={17} /> : <SlidersHorizontal size={17} />}
        </span>
        <span {...stylex.props(styles.connectionCopy)}>
          <strong>{configured ? "连接已就绪" : "还没有配置图像接口"}</strong>
          <small>
            {configured
              ? "可直接在下方输入提示词并开始创作。"
              : "配置 Endpoint 和 API Key 后即可使用 gpt-image-2 开始生成。"}
          </small>
        </span>
        {!configured ? (
          <button
            type="button"
            {...stylex.props(styles.connectionAction)}
            onClick={onOpenSettings}
          >
            配置连接
          </button>
        ) : null}
      </div>

      <div {...stylex.props(styles.starterHeader)}>
        <strong>快速开始</strong>
        <span {...stylex.props(styles.starterHint)}>点击示例，将完整提示词放入输入框</span>
      </div>

      <div {...stylex.props(styles.tiles)}>
        {PROMPT_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            {...stylex.props(styles.tile)}
            onClick={() => onChoosePrompt(item.description)}
          >
            <span {...stylex.props(styles.tileIcon)} aria-hidden="true">
              {item.icon}
            </span>
            <span {...stylex.props(styles.tileCopy)}>
              <strong>{item.label}</strong>
              <span {...stylex.props(styles.tileSummary)}>{item.summary}</span>
            </span>
          </button>
        ))}
      </div>

      <div {...stylex.props(styles.note)}>
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span>提示：主体、环境、构图、光线、材质和画面比例描述得更清楚，通常更容易得到符合预期的结果。</span>
      </div>
    </section>
  );
}

const PROMPT_ITEMS = [
  {
    key: "product",
    icon: <Camera size={18} aria-hidden="true" />,
    label: "产品摄影",
    summary: "干净背景与精确材质",
    description:
      "一只砂银色智能手表悬浮在深灰摄影棚中，侧后方柔光勾勒金属边缘，微距产品摄影，克制高级，方形构图",
  },
  {
    key: "poster",
    icon: <LayoutTemplate size={18} aria-hidden="true" />,
    label: "概念海报",
    summary: "强烈氛围与清晰构图",
    description:
      "未来城市公共交通主题概念海报，巨大的圆形站台与薄雾中的人群，冷暖对比光，建筑摄影感，纵向构图，不要文字",
  },
  {
    key: "story",
    icon: <Clapperboard size={18} aria-hidden="true" />,
    label: "叙事场景",
    summary: "电影感瞬间与空间层次",
    description:
      "雨夜旧书店即将打烊，店员站在暖色窗边整理最后一本书，街道倒影延伸到远处，电影静帧，35mm 胶片质感，横向构图",
  },
] as const;

const styles = stylex.create({
  root: {
    width: "min(1120px, 100%)",
    height: "100%",
    minHeight: 0,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    gap: "18px",
    padding: "clamp(20px, 4vh, 42px) 24px 24px",
    margin: "0 auto",
    overflow: "visible",
    "@media (max-width: 767px)": {
      gap: "14px",
      justifyContent: "flex-start",
      padding: "22px 14px 16px",
    },
    "@media (max-height: 760px)": {
      justifyContent: "flex-start",
      gap: "12px",
      paddingTop: "18px",
      paddingBottom: "12px",
    },
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    color: colors.primary,
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  intro: {
    maxWidth: "760px",
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
    fontSize: "clamp(30px, 4.2vw, 48px)",
    fontWeight: 650,
    lineHeight: 1.08,
    letterSpacing: "-0.035em",
  },
  titleAccent: {
    color: colors.primary,
  },
  copy: {
    maxWidth: "680px",
    margin: "10px 0 0",
    color: colors.body,
    fontSize: "14px",
    lineHeight: 1.6,
    "@media (max-height: 700px)": {
      marginTop: "6px",
      fontSize: "13px",
      lineHeight: 1.45,
    },
  },
  connectionCard: {
    width: "min(680px, 100%)",
    minHeight: "54px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    color: colors.body,
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
  },
  connectionCardIncomplete: {
    borderColor: colors.primarySoftHover,
  },
  connectionIcon: {
    width: "30px",
    height: "30px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.small,
  },
  connectionCopy: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    lineHeight: 1.3,
  },
  connectionAction: {
    minHeight: "36px",
    flexShrink: 0,
    padding: "0 13px",
    color: colors.onPrimary,
    fontSize: "12px",
    fontWeight: 700,
    backgroundColor: colors.primary,
    borderWidth: 0,
    borderRadius: radii.pill,
    cursor: "pointer",
    transitionProperty: "background-color, box-shadow, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      backgroundColor: colors.primaryHover,
      boxShadow: shadows.interactive,
    },
    ":active": { transform: "scale(0.98)" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
      outlineOffset: "2px",
    },
    "@media (max-width: 520px)": {
      paddingInline: "10px",
    },
  },
  starterHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
    color: colors.ink,
    fontSize: "13px",
    "@media (max-height: 700px)": {
      gap: "6px",
    },
  },
  starterHint: {
    color: colors.muted,
    fontSize: "11px",
    "@media (max-height: 700px)": {
      display: "none",
    },
  },
  tiles: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 560px)": {
      gridTemplateColumns: "1fr",
    },
  },
  tile: {
    minWidth: 0,
    minHeight: "74px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 12px",
    color: colors.body,
    textAlign: "left",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
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
    ":active": { transform: "scale(0.99)" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
      outlineOffset: "2px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
    "@media (max-height: 700px)": {
      minHeight: "62px",
      paddingBlock: "8px",
    },
  },
  tileIcon: {
    width: "32px",
    height: "32px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.small,
  },
  tileCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    lineHeight: 1.3,
    "@media (max-height: 700px)": {
      gap: 0,
    },
  },
  tileSummary: {
    color: colors.muted,
    fontSize: "11px",
    "@media (max-height: 700px)": {
      display: "none",
    },
  },
  note: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: colors.muted,
    fontSize: "11px",
    lineHeight: 1.45,
    "@media (max-height: 700px)": {
      display: "none",
    },
  },
});
