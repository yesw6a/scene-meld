import * as stylex from "@stylexjs/stylex";
import { App as AntdApp, Tooltip } from "antd";
import {
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
} from "lucide-react";

import BrandMark from "./BrandMark";
import WorkspaceTools from "./WorkspaceTools";
import type { Conversation } from "../types";
import { colors, materials, motion, radii, shadows } from "../styles/tokens.stylex";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  embedded?: boolean;
  collapsed?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  deletionDisabled?: boolean;
  deletionDisabledReason?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenData?: () => void;
  onOpenAppearance?: () => void;
  onOpenAbout?: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  embedded = false,
  collapsed = false,
  disabled = false,
  disabledReason,
  deletionDisabled = false,
  deletionDisabledReason,
  onCollapsedChange,
  onSelect,
  onCreate,
  onDelete,
  onOpenData,
  onOpenAppearance,
  onOpenAbout,
}: SidebarProps) {
  const navigationCollapsed = collapsed && !embedded;
  const { modal } = AntdApp.useApp();

  const confirmDelete = (conversation: Conversation) => {
    modal.confirm({
      title: `删除“${conversation.title}”？`,
      content: "消息、参考图、生成图片和未发送内容将从当前设备删除；应用内无法撤销。",
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      centered: true,
      mask: { closable: false },
      onOk: () => onDelete(conversation.id),
    });
  };

  return (
    <aside
      {...stylex.props(
        styles.root,
        embedded && styles.embedded,
        navigationCollapsed && styles.collapsed,
      )}
      aria-label="创作会话"
    >
      <div {...stylex.props(styles.brand, navigationCollapsed && styles.brandCollapsed)}>
        <div {...stylex.props(styles.brandIdentity)}>
          <span {...stylex.props(styles.brandMark)} aria-hidden="true">
            <BrandMark size={23} animated />
          </span>
          {!navigationCollapsed ? (
            <span {...stylex.props(styles.brandCopy)}>
              <strong>SceneMeld</strong>
              <small>Image workspace</small>
            </span>
          ) : null}
        </div>

        {!embedded ? (
          <Tooltip title={navigationCollapsed ? "展开导航" : "收起导航"} placement="right">
            <button
              type="button"
              {...stylex.props(styles.collapseButton)}
              aria-label={navigationCollapsed ? "展开导航" : "收起导航"}
              aria-expanded={!navigationCollapsed}
              onClick={() => onCollapsedChange?.(!navigationCollapsed)}
            >
              {navigationCollapsed ? (
                <PanelLeftOpen size={18} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={18} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        ) : null}
      </div>

      <Tooltip
        title={disabled ? disabledReason : navigationCollapsed ? "新建创作" : undefined}
        placement="right"
      >
        <span {...stylex.props(styles.newButtonWrapper)}>
          <button
            type="button"
            {...stylex.props(styles.newButton, navigationCollapsed && styles.newButtonCollapsed)}
            disabled={disabled}
            aria-label="新建创作"
            onClick={onCreate}
          >
            <Plus size={18} aria-hidden="true" />
            {!navigationCollapsed ? <span>新建创作</span> : null}
          </button>
        </span>
      </Tooltip>

      {!navigationCollapsed ? <div {...stylex.props(styles.label)}>最近会话</div> : null}
      <nav {...stylex.props(styles.list, navigationCollapsed && styles.listCollapsed)}>
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId;
          const isSoleEmptyConversation =
            conversations.length === 1 && conversation.messages.length === 0;
          const selectButton = (
            <button
              type="button"
              {...stylex.props(styles.item, navigationCollapsed && styles.itemCollapsed)}
              aria-current={isActive ? "page" : undefined}
              aria-label={navigationCollapsed ? conversation.title : undefined}
              onClick={() => onSelect(conversation.id)}
            >
              <MessageSquare size={17} aria-hidden="true" strokeWidth={1.7} />
              {!navigationCollapsed ? (
                <span {...stylex.props(styles.itemTitle)}>{conversation.title}</span>
              ) : null}
            </button>
          );

          return (
            <div
              key={conversation.id}
              {...stylex.props(
                styles.itemRow,
                isActive && styles.itemRowActive,
                navigationCollapsed && styles.itemRowCollapsed,
              )}
            >
              {navigationCollapsed ? (
                <Tooltip title={conversation.title} placement="right">
                  {selectButton}
                </Tooltip>
              ) : (
                selectButton
              )}
              {!navigationCollapsed && !isSoleEmptyConversation ? (
                <Tooltip
                  title={
                    deletionDisabled
                      ? deletionDisabledReason
                      : `删除“${conversation.title}”`
                  }
                  placement="right"
                >
                  <span {...stylex.props(styles.deleteAction)}>
                    <button
                      type="button"
                      {...stylex.props(
                        styles.deleteButton,
                        embedded && styles.deleteButtonEmbedded,
                      )}
                      disabled={deletionDisabled}
                      aria-label={`删除会话：${conversation.title}`}
                      onClick={() => confirmDelete(conversation)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </Tooltip>
              ) : null}
            </div>
          );
        })}
      </nav>

      {onOpenData && onOpenAppearance && onOpenAbout ? (
        <WorkspaceTools
          collapsed={navigationCollapsed}
          onOpenData={onOpenData}
          onOpenAppearance={onOpenAppearance}
          onOpenAbout={onOpenAbout}
        />
      ) : null}
    </aside>
  );
}

const styles = stylex.create({
  root: {
    width: "272px",
    height: "calc(100% - 24px)",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    padding: "20px 14px 16px",
    margin: "12px",
    color: colors.ink,
    backgroundColor: colors.glassChrome,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.xlarge,
    boxShadow: shadows.glass,
    WebkitBackdropFilter: materials.chrome,
    backdropFilter: materials.chrome,
    transitionProperty: "width, padding, background-color, border-color, box-shadow",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
    "@media (max-width: 767px)": {
      display: "none",
    },
  },
  embedded: {
    display: "flex",
    width: "100%",
    height: "100%",
    margin: 0,
    borderWidth: 0,
    borderRadius: 0,
    boxShadow: "none",
  },
  collapsed: {
    width: "68px",
    padding: "14px 8px",
  },
  brand: {
    minHeight: "52px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "0 4px",
  },
  brandCollapsed: {
    minHeight: 0,
    flexDirection: "column",
    justifyContent: "flex-start",
    padding: 0,
  },
  brandIdentity: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  brandMark: {
    width: "38px",
    height: "38px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  brandCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    whiteSpace: "nowrap",
  },
  collapseButton: {
    width: "44px",
    height: "44px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: colors.muted,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.small,
    cursor: "pointer",
    transitionProperty: "color, background-color, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": { color: colors.ink, backgroundColor: colors.glassSubtle },
    ":active": { transform: "scale(0.94)" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  newButtonWrapper: {
    width: "100%",
    display: "block",
    marginTop: "18px",
  },
  newButton: {
    width: "100%",
    minHeight: "46px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    color: colors.onPrimary,
    fontSize: "14px",
    fontWeight: 600,
    backgroundColor: colors.primary,
    borderWidth: 0,
    borderRadius: radii.pill,
    cursor: "pointer",
    transitionProperty: "background-color, opacity, box-shadow, transform",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": {
      backgroundColor: colors.primaryHover,
      boxShadow: shadows.interactive,
    },
    ":active": {
      backgroundColor: colors.primaryPressed,
      transform: "scale(0.985)",
    },
    ":focus-visible": {
      outlineWidth: "3px",
      outlineStyle: "solid",
      outlineColor: colors.primary,
    },
    ":disabled": { opacity: 0.45, cursor: "not-allowed" },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  newButtonCollapsed: {
    minHeight: "44px",
    padding: 0,
  },
  label: {
    margin: "28px 8px 10px",
    color: colors.muted,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
  },
  list: {
    minHeight: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
  },
  listCollapsed: {
    marginTop: "20px",
    alignItems: "center",
  },
  itemRow: {
    width: "100%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: radii.small,
  },
  itemRowActive: {
    backgroundColor: colors.glassSubtle,
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: colors.glassBorder,
    outlineOffset: "-1px",
  },
  itemRowCollapsed: {
    width: "44px",
  },
  item: {
    minWidth: 0,
    minHeight: "44px",
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 6px 8px 10px",
    overflow: "hidden",
    color: colors.body,
    fontSize: "14px",
    textAlign: "left",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.small,
    cursor: "pointer",
    transitionProperty: "background-color, color, transform",
    transitionDuration: motion.standard,
    transitionTimingFunction: motion.easing,
    ":hover": { color: colors.ink, backgroundColor: colors.glassSubtle },
    ":active": { transform: "scale(0.985)" },
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
  itemCollapsed: {
    width: "44px",
    flex: "none",
    justifyContent: "center",
    padding: 0,
  },
  itemTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  deleteAction: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
  },
  deleteButton: {
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    color: colors.dangerOnDark,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: radii.small,
    cursor: "pointer",
    opacity: 0.86,
    transitionProperty: "background-color, color, opacity, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.dangerOnDark,
      backgroundColor: colors.dangerOnDarkSoft,
      opacity: 1,
    },
    ":active": {
      backgroundColor: colors.dangerOnDarkSoft,
      transform: "scale(0.92)",
      opacity: 1,
    },
    ":focus-visible": {
      color: colors.dangerOnDark,
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors.focus,
      outlineOffset: "-2px",
      opacity: 1,
    },
    ":disabled": {
      opacity: 0.32,
      cursor: "not-allowed",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  deleteButtonEmbedded: {
    width: "44px",
    height: "44px",
  },
});
