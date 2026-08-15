import * as stylex from "@stylexjs/stylex";
import { Button, Progress, Typography } from "antd";
import { AlertCircle, Download, RefreshCw, Sparkles } from "lucide-react";

import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";
import { desktopChrome } from "../styles/desktop-chrome.stylex";
import { colors, motion, radii, shadows } from "../styles/tokens.stylex";

interface DesktopUpdateNoticeProps {
  snapshot: DesktopUpdateSnapshot;
  busy: boolean;
  onCheck: () => void | Promise<void>;
  onInstall: () => void | Promise<void>;
}

export default function DesktopUpdateNotice({
  snapshot,
  busy,
  onCheck,
  onInstall,
}: DesktopUpdateNoticeProps) {
  const available = snapshot.status === "available";
  const downloading = snapshot.status === "downloading" || snapshot.status === "installing";
  const failed = snapshot.status === "error";

  if (!available && !downloading && !failed) {
    return null;
  }

  return (
    <aside
      {...stylex.props(styles.notice)}
      aria-label="桌面更新提示"
      aria-live={available || failed ? "polite" : "off"}
    >
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.icon)} aria-hidden="true">
          {failed ? <AlertCircle size={16} /> : <Sparkles size={16} />}
        </span>
        <div {...stylex.props(styles.heading)}>
          <strong>{failed ? "桌面更新检查失败" : "桌面有新版本"}</strong>
          <Typography.Text type="secondary">
            {available
              ? `版本 ${snapshot.version ?? "待确认"}`
              : downloading
                ? snapshot.status === "installing"
                  ? "正在准备重启"
                  : "正在下载更新"
                : "可以稍后重试"}
          </Typography.Text>
        </div>
      </div>

      {available ? (
        <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} {...stylex.props(styles.copy)}>
          {snapshot.body || "暂无更新说明"}
        </Typography.Paragraph>
      ) : null}

      {downloading ? (
        <Progress
          percent={snapshot.progress}
          size="small"
          status={snapshot.status === "installing" ? "active" : undefined}
          showInfo={Boolean(snapshot.progress)}
        />
      ) : null}

      {failed && snapshot.error ? (
        <Typography.Text type="danger" ellipsis={{ tooltip: snapshot.error }}>
          {snapshot.error}
        </Typography.Text>
      ) : null}

      <div {...stylex.props(styles.actions)}>
        {available ? (
          <Button
            type="primary"
            size="small"
            icon={<Download size={14} />}
            disabled={busy}
            onClick={() => void onInstall()}
          >
            {busy ? "正在准备更新" : "下载并重启"}
          </Button>
        ) : null}
        {failed ? (
          <Button
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() => void onCheck()}
          >
            重试
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

const noticeIn = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(8px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  notice: {
    position: "fixed",
    left: "max(300px, calc(16px + env(safe-area-inset-left)))",
    bottom: "max(16px, env(safe-area-inset-bottom))",
    zIndex: desktopChrome.floatingNoticeLayer,
    width: "min(320px, calc(100vw - 32px))",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    color: colors.ink,
    backgroundColor: colors.glassOverlay,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.large,
    boxShadow: shadows.overlay,
    WebkitBackdropFilter: "blur(28px) saturate(165%)",
    backdropFilter: "blur(28px) saturate(165%)",
    pointerEvents: "auto",
    animationName: noticeIn,
    animationDuration: motion.standard,
    animationTimingFunction: motion.easing,
    "@media (max-width: 767px)": {
      left: "12px",
      bottom: "12px",
      width: "calc(100vw - 24px)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
  },
  icon: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.small,
  },
  heading: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    lineHeight: 1.3,
  },
  copy: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
});
