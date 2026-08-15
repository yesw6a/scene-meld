import * as stylex from "@stylexjs/stylex";
import { Tooltip } from "antd";
import { Database, Info, Palette } from "lucide-react";

import { colors, materials, motion, radii, shadows } from "../styles/tokens.stylex";

interface WorkspaceToolsProps {
  collapsed?: boolean;
  onOpenData: () => void;
  onOpenAppearance: () => void;
  onOpenAbout: () => void;
}

export default function WorkspaceTools({
  collapsed = false,
  onOpenData,
  onOpenAppearance,
  onOpenAbout,
}: WorkspaceToolsProps) {
  const showLabels = !collapsed;
  const items = [
    {
      key: "data",
      icon: <Database size={17} aria-hidden="true" />,
      label: "本地数据",
      onClick: onOpenData,
    },
    {
      key: "appearance",
      icon: <Palette size={17} aria-hidden="true" />,
      label: "外观",
      onClick: onOpenAppearance,
    },
    {
      key: "about",
      icon: <Info size={17} aria-hidden="true" />,
      label: "关于",
      onClick: onOpenAbout,
    },
  ];

  return (
    <nav
      {...stylex.props(styles.root, collapsed && styles.rootCollapsed)}
      aria-label="工作区工具"
    >
      <div {...stylex.props(styles.list, showLabels ? styles.labeledList : styles.compactList)}>
        {items.map((item) => {
          const button = (
            <button
              key={item.key}
              type="button"
              {...stylex.props(styles.item, showLabels ? styles.itemLabeled : styles.itemCompact)}
              aria-label={item.label}
              onClick={item.onClick}
            >
              <span {...stylex.props(styles.icon)} aria-hidden="true">
                {item.icon}
              </span>
              {showLabels ? <span {...stylex.props(styles.label)}>{item.label}</span> : null}
            </button>
          );

          return !showLabels ? (
            <Tooltip key={item.key} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </div>
    </nav>
  );
}

const styles = stylex.create({
  root: {
    marginTop: "auto",
    paddingTop: "10px",
  },
  rootCollapsed: {
    paddingTop: "16px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  compactList: {
    alignItems: "center",
  },
  item: {
    minWidth: 0,
    minHeight: "44px",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "6px 7px",
    color: colors.muted,
    fontSize: "13px",
    whiteSpace: "nowrap",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.small,
    cursor: "pointer",
    transitionProperty: "color, background-color, box-shadow, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.ink,
      backgroundColor: colors.glassSubtle,
      boxShadow: shadows.subtle,
    },
    ":active": { transform: "scale(0.97)" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
      outlineOffset: "-2px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  itemCompact: {
    width: "44px",
    flex: "none",
    padding: 0,
  },
  labeledList: {
    alignItems: "stretch",
  },
  itemLabeled: {
    width: "100%",
    flex: "none",
    justifyContent: "flex-start",
    paddingLeft: "10px",
    paddingRight: "10px",
  },
  icon: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: "inherit",
    backgroundColor: colors.glassSubtle,
    borderRadius: radii.small,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
  },
  label: {
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});
