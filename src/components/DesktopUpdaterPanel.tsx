import { lazy, Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { Alert, Button, Progress, Typography } from "antd";
import { CheckCircle2, Download, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";

import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";
import { updateActivityLabel, updateSourceLabel } from "../lib/updatePresentation";
import { updaterStyles } from "../styles/updater.stylex";
import { colors, motion, radii } from "../styles/tokens.stylex";

const ReleaseNotes = lazy(() => import("./ReleaseNotes"));

interface DesktopUpdaterPanelProps {
  snapshot: DesktopUpdateSnapshot;
  busy: boolean;
  onCheck: () => void | Promise<void>;
  onInstall: () => void | Promise<void>;
  preview?: boolean;
}

export default function DesktopUpdaterPanel({
  snapshot,
  busy,
  onCheck,
  onInstall,
  preview = false,
}: DesktopUpdaterPanelProps) {
  const checking = snapshot.status === "checking";
  const downloading = snapshot.status === "downloading" || snapshot.status === "installing";
  const disabled = snapshot.status === "disabled" || checking || downloading;

  return (
    <section className="desktop-updater-panel" aria-labelledby="desktop-updates-heading">
      <div {...stylex.props(styles.heading)}>
        <div {...stylex.props(styles.titleRow)}>
          <Typography.Title id="desktop-updates-heading" level={5}>
            桌面更新
          </Typography.Title>
          <span {...stylex.props(styles.badge)}>
            <Sparkles size={13} aria-hidden="true" />
            {preview ? "开发预览" : "生产桌面版"}
          </span>
        </div>
      </div>

      {snapshot.source && !checking && !downloading ? (
        <Typography.Text type="secondary" className="update-panel-source">当前来源：{updateSourceLabel(snapshot)}{snapshot.source === "proxy" ? "（可能存在缓存延迟）" : ""}</Typography.Text>
      ) : null}

      {checking || downloading ? (
        <div role="status" aria-live="polite" {...stylex.props(updaterStyles.activity)}>
          <span {...stylex.props(updaterStyles.spinning)} aria-hidden="true"><LoaderCircle size={16} /></span>
          <Typography.Text>{checking ? updateActivityLabel(snapshot) : snapshot.phase === "verifying" ? "下载完成，正在校验签名" : snapshot.status === "installing" ? "正在安装更新，完成后重启" : `正在下载 · ${updateSourceLabel(snapshot)}`}</Typography.Text>
        </div>
      ) : null}

      {snapshot.status === "disabled" ? (
        <Alert showIcon type="info" message="当前运行环境不提供生产桌面更新。" />
      ) : null}

      {snapshot.status === "idle" ? (
        <Alert
          showIcon
          type="success"
          icon={<CheckCircle2 size={16} />}
          message={
            snapshot.currentVersion
              ? `未发现可用更新（${snapshot.currentVersion}）`
              : "未发现可用更新"
          }
        />
      ) : null}

      {snapshot.status === "available" ? (
        <Typography.Text strong>{`发现新版本 ${snapshot.version ?? ""}`}</Typography.Text>
      ) : null}

      {snapshot.status === "available" ? (
        <div key={snapshot.version} className="update-notes-scroll" tabIndex={0} role="region" aria-label="更新日志">
          <Suspense fallback={<Typography.Text>加载更新说明…</Typography.Text>}>
            <ReleaseNotes body={snapshot.body} />
          </Suspense>
        </div>
      ) : null}

      {downloading ? (
        <div {...stylex.props(styles.progressBlock)}>
          <Typography.Text>
            {updateActivityLabel(snapshot)}
          </Typography.Text>
          {typeof snapshot.progress === "number" ? <Progress percent={snapshot.progress} status={snapshot.status === "installing" ? "active" : undefined} /> : null}
        </div>
      ) : null}

      {snapshot.status === "error" ? (
        <Alert showIcon type="error" message={snapshot.error || "更新失败"} />
      ) : null}

      <div className="update-panel-actions">
        {snapshot.status === "available" ? (
          <Button type="primary" icon={<Download size={15} />} disabled={busy || preview} onClick={() => void onInstall()}>
            {busy ? "正在准备更新" : "下载并重启"}
          </Button>
        ) : null}
        <Button
          icon={<RefreshCw size={15} />}
          loading={checking}
          disabled={disabled || preview}
          onClick={() => void onCheck()}
        >
          检查更新
        </Button>
      </div>
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  heading: {
    display: "flex",
    flexDirection: "column",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 7px",
    color: colors.primary,
    fontSize: "11px",
    fontWeight: 600,
    backgroundColor: colors.primarySoft,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.pill,
  },
  copy: {
    marginTop: "-4px",
    marginBottom: 0,
    lineHeight: 1.65,
  },
  progressBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    backgroundColor: colors.glassSubtle,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.medium,
    transition: `background-color ${motion.fast} ${motion.easing}`,
  },
});
