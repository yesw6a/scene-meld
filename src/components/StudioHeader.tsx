import * as stylex from "@stylexjs/stylex";
import { Button, Tag, Tooltip } from "antd";
import { Menu } from "lucide-react";

import type { Conversation } from "../types";
import { colors, materials, motion, radii, shadows } from "../styles/tokens.stylex";

interface StudioHeaderProps {
  conversation: Conversation;
  generationCount: number;
  connection: {
    label: string;
    description: string;
    color?: string;
  };
  endpointLabel: string;
  model: string;
  onOpenNavigation: () => void;
  onOpenSettings: () => void;
}

export default function StudioHeader({
  conversation,
  generationCount,
  connection,
  endpointLabel,
  model,
  onOpenNavigation,
  onOpenSettings,
}: StudioHeaderProps) {
  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.headerStart)}>
        <Tooltip title="打开会话列表" placement="bottom">
          <Button
            type="text"
            icon={<Menu size={20} />}
            aria-label="打开会话列表"
            className={stylex.props(styles.mobileMenu, styles.headerButton).className}
            onClick={onOpenNavigation}
          />
        </Tooltip>
        <div {...stylex.props(styles.headerTitle)}>
          <Tooltip title={conversation.title} mouseEnterDelay={0.5} placement="bottom">
            <strong {...stylex.props(styles.headerTitleText)}>{conversation.title}</strong>
          </Tooltip>
          <span {...stylex.props(styles.headerSubtitle)}>{generationCount} 次生成</span>
        </div>
      </div>

      <div {...stylex.props(styles.headerActions)}>
        <span {...stylex.props(styles.connectionState)}>
          <Tooltip title={`${connection.description} ${endpointLabel}`} placement="bottom">
            <button
              type="button"
              {...stylex.props(styles.connectionTrigger)}
              aria-label={`打开连接信息：${connection.label}`}
              onClick={onOpenSettings}
            >
              <Tag color={connection.color} className={stylex.props(styles.statusTag).className}>
                {connection.label}
              </Tag>
            </button>
          </Tooltip>
        </span>
        <span {...stylex.props(styles.modelBadge)}>
          {endpointLabel} · {model}
        </span>
      </div>
    </header>
  );
}

const styles = stylex.create({
  header: {
    position: "relative",
    zIndex: 10,
    minHeight: "70px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "10px 22px",
    backgroundColor: colors.glassChrome,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.xlarge,
    boxShadow: shadows.glass,
    WebkitBackdropFilter: materials.chrome,
    backdropFilter: materials.chrome,
    "@media (max-width: 767px)": {
      minHeight: "62px",
      padding: "8px 10px",
    },
  },
  headerStart: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  mobileMenu: {
    display: "none",
    "@media (max-width: 767px)": { display: "inline-flex" },
  },
  headerButton: {
    color: colors.muted,
    borderRadius: radii.pill,
    transitionProperty: "color, background-color, border-color, transform, box-shadow",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderColor: colors.primarySoftHover,
    },
    ":active": {
      color: colors.primaryPressed,
      backgroundColor: colors.primarySoftHover,
      transform: "scale(0.96)",
    },
    ":focus-visible": {
      boxShadow: shadows.focus,
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  headerTitle: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    color: colors.ink,
    fontSize: "14px",
    lineHeight: 1.35,
  },
  headerTitleText: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: "12px",
  },
  headerActions: {
    minWidth: 0,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    "@media (max-width: 767px)": {
      gap: "4px",
    },
  },
  connectionState: {
    display: "inline-flex",
    "@media (max-width: 760px)": {
      display: "none",
    },
  },
  connectionTrigger: {
    display: "inline-flex",
    padding: 0,
    color: "inherit",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.pill,
    cursor: "pointer",
    ":focus-visible": {
      boxShadow: shadows.focus,
    },
  },
  statusTag: {
    minHeight: "28px",
    display: "inline-flex",
    alignItems: "center",
    paddingInline: "10px",
    marginInlineEnd: 0,
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
  },
  modelBadge: {
    maxWidth: "220px",
    overflow: "hidden",
    padding: "5px 9px",
    color: colors.muted,
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "12px",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
    "@media (max-width: 1050px)": { display: "none" },
  },
});
