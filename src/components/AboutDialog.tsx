import { lazy, Suspense, useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button, Modal, Tag, Typography } from "antd";

import packageInfo from "../../package.json";
import DesktopUpdaterPanel from "./DesktopUpdaterPanel";
import BrandMark from "./BrandMark";
import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";
import { isDesktopRuntime } from "../lib/runtime";
import { colors, radii } from "../styles/tokens.stylex";
import "./about-updates.css";

const UpdatePreview = import.meta.env.DEV
  ? lazy(() => import("./dev/UpdatePreview"))
  : null;

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  desktopUpdateSnapshot: DesktopUpdateSnapshot;
  updateBusy: boolean;
  onCheckForUpdates: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
}

export default function AboutDialog({
  open,
  onClose,
  desktopUpdateSnapshot,
  updateBusy,
  onCheckForUpdates,
  onInstallUpdate,
}: AboutDialogProps) {
  const desktop = isDesktopRuntime();
  const [version, setVersion] = useState(packageInfo.version);

  useEffect(() => {
    if (!open || !desktop) {
      return;
    }

    let disposed = false;
    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((nextVersion) => {
        if (!disposed && nextVersion) {
          setVersion(nextVersion);
        }
      })
      .catch(() => {
        // Web/package version is a safe fallback when the runtime API is unavailable.
      });

    return () => {
      disposed = true;
    };
  }, [desktop, open]);

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      centered
      width="min(680px, calc(100vw - 32px))"
      rootClassName="studio-about-modal"
    >
      <div className="about-dialog-content">
        <div className="about-dialog-header">
        <div {...stylex.props(styles.brand)}>
          <span {...stylex.props(styles.mark)}>
            <BrandMark size={60} title="SceneMeld" />
          </span>
          <div {...stylex.props(styles.brandCopy)}>
            <Typography.Title level={3}>SceneMeld</Typography.Title>
            <Typography.Text type="secondary">对话式图片创作工作区</Typography.Text>
          </div>
        </div>

        <div className="about-dialog-meta">
            <span>当前版本 <Tag>{version}</Tag></span>
            <Tag color={desktop ? "blue" : "default"}>
              {desktop ? "SceneMeld Desktop" : "SceneMeld Web"}
            </Tag>
            <Typography.Link
              href="https://github.com/yesw6a/scene-meld"
              target="_blank"
              rel="noreferrer noopener"
            >
              开源仓库
            </Typography.Link>
        </div>

        <details className="about-dialog-info">
          <summary>关于 SceneMeld 与数据说明</summary>
        <Typography.Paragraph type="secondary" {...stylex.props(styles.description)}>
          SceneMeld 默认尝试将创作记录保存在当前设备，并把请求发送到你配置的兼容 Images API Endpoint。
          本项目不提供图片请求中转服务；目标 Endpoint 的处理方式由其运营者决定。
        </Typography.Paragraph>
          <p>创作记录不是永久备份。SceneMeld 是独立开源项目，不代表或隶属于任何模型提供商或 Endpoint 运营者。</p>
          <p>SceneMeld © 2026 contributors</p>
        </details>
        </div>

        {UpdatePreview ? (
          <Suspense fallback={<Typography.Text>加载更新预览…</Typography.Text>}>
            <UpdatePreview />
          </Suspense>
        ) : desktop ? (
            <DesktopUpdaterPanel
              snapshot={desktopUpdateSnapshot}
              busy={updateBusy}
              onCheck={onCheckForUpdates}
              onInstall={onInstallUpdate}
            />
        ) : null}
      </div>
    </Modal>
  );
}

const styles = stylex.create({
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  mark: {
    width: "64px",
    height: "64px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: radii.medium,
    boxShadow: `0 1px 2px ${colors.glassBorder}`,
  },
  brandCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  description: {
    margin: 0,
    lineHeight: 1.65,
  },
});
