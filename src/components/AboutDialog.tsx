import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Divider, Modal, Space, Tag, Typography } from "antd";

import packageInfo from "../../package.json";
import DesktopUpdaterPanel from "./DesktopUpdaterPanel";
import BrandMark from "./BrandMark";
import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";
import { isDesktopRuntime } from "../lib/runtime";
import { colors, radii } from "../styles/tokens.stylex";

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
      footer={null}
      centered
      width="min(460px, calc(100vw - 32px))"
      rootClassName="studio-about-modal"
    >
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.brand)}>
          <span {...stylex.props(styles.mark)}>
            <BrandMark size={60} title="SceneMeld" />
          </span>
          <div {...stylex.props(styles.brandCopy)}>
            <Typography.Title level={3}>SceneMeld</Typography.Title>
            <Typography.Text type="secondary">对话式图片创作工作区</Typography.Text>
          </div>
        </div>

        <div {...stylex.props(styles.meta)}>
          <div {...stylex.props(styles.metaRow)}>
            <span>版本</span>
            <Tag>{version}</Tag>
          </div>
          <div {...stylex.props(styles.metaRow)}>
            <span>运行环境</span>
            <Tag color={desktop ? "blue" : "default"}>
              {desktop ? "SceneMeld Desktop" : "SceneMeld Web"}
            </Tag>
          </div>
          <div {...stylex.props(styles.metaRow)}>
            <span>开源仓库</span>
            <Typography.Link
              href="https://github.com/yesw6a/scene-meld"
              target="_blank"
              rel="noreferrer noopener"
            >
              github.com/yesw6a/scene-meld
            </Typography.Link>
          </div>
        </div>

        <Typography.Paragraph type="secondary" {...stylex.props(styles.description)}>
          SceneMeld 默认尝试将创作记录保存在当前设备，并把请求发送到你配置的兼容 Images API Endpoint。
          本项目不提供图片请求中转服务；目标 Endpoint 的处理方式由其运营者决定。
        </Typography.Paragraph>

        {desktop ? (
          <>
            <Divider />
            <DesktopUpdaterPanel
              snapshot={desktopUpdateSnapshot}
              busy={updateBusy}
              onCheck={onCheckForUpdates}
              onInstall={onInstallUpdate}
            />
          </>
        ) : null}

        <Space direction="vertical" size={2} {...stylex.props(styles.footnote)}>
          <Typography.Text type="secondary">
            {desktop ? "桌面版版本号来自应用运行时；" : "Web 版版本号来自构建信息；"}
            创作记录不是永久备份。
          </Typography.Text>
          <Typography.Text type="secondary">
            SceneMeld 是独立开源项目，不代表或隶属于任何模型提供商或 Endpoint 运营者。
          </Typography.Text>
          <Typography.Text type="secondary">SceneMeld © 2026 contributors</Typography.Text>
        </Space>
      </div>
    </Modal>
  );
}

const styles = stylex.create({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    paddingTop: "10px",
  },
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
  meta: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: colors.muted,
    fontSize: "13px",
  },
  description: {
    margin: 0,
    lineHeight: 1.65,
  },
  footnote: {
    fontSize: "12px",
  },
});
