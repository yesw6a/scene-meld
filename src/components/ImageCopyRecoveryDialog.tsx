import type { CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";
import { Alert, Button, Modal, Typography } from "antd";
import { ClipboardX, Download, RotateCw } from "lucide-react";

import type { ImageCopyError } from "../lib/image-actions";
import { isDesktopRuntime } from "../lib/runtime";
import { colors, radii } from "../styles/tokens.stylex";

interface ImageCopyRecoveryDialogProps {
  error: ImageCopyError | null;
  retrying: boolean;
  onClose: () => void;
  onRetry: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
}

export default function ImageCopyRecoveryDialog({
  error,
  retrying,
  onClose,
  onRetry,
  onDownload,
}: ImageCopyRecoveryDialogProps) {
  const desktop = isDesktopRuntime();
  const guidance = error ? copyGuidance(error, desktop) : null;

  return (
    <Modal
      title={
        <span {...stylex.props(styles.title)}>
          <ClipboardX size={18} aria-hidden="true" />
          图片没有复制成功
        </span>
      }
      open={Boolean(error)}
      width="min(560px, calc(100vw - 32px))"
      styles={MODAL_STYLES}
      footer={
        <div {...stylex.props(styles.footer)}>
          <Button className="studio-dialog-action" onClick={onClose}>稍后处理</Button>
          <Button className="studio-dialog-action" icon={<Download size={16} />} onClick={() => void onDownload()}>
            下载 PNG
          </Button>
          <Button
            type="primary"
            className="studio-dialog-action"
            icon={<RotateCw size={16} />}
            loading={retrying}
            onClick={() => void onRetry()}
          >
            重试复制
          </Button>
        </div>
      }
      onCancel={onClose}
    >
      {error && guidance ? (
        <div {...stylex.props(styles.content)}>
          <Alert
            type={guidance.type}
            showIcon
            message={guidance.title}
            description={guidance.description}
          />

          {guidance.steps?.length ? (
            <section aria-labelledby="clipboard-help-heading" {...stylex.props(styles.help)}>
              <Typography.Text id="clipboard-help-heading" strong>
                授权后这样操作
              </Typography.Text>
              <ol {...stylex.props(styles.steps)}>
                {guidance.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>
          ) : null}

          <Typography.Paragraph type="secondary" {...stylex.props(styles.fallback)}>
            如果暂时无法解决，可以先下载 PNG；图片不会因为复制失败而被删除。
          </Typography.Paragraph>

          {error.technicalDetails ? (
            <details {...stylex.props(styles.details)}>
              <summary>查看技术详情</summary>
              <code>{error.technicalDetails}</code>
            </details>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function copyGuidance(
  error: ImageCopyError,
  desktop: boolean,
): {
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  steps?: string[];
} {
  if (error.code === "permission-denied" && !desktop) {
    return {
      type: "warning",
      title: "浏览器阻止了剪贴板写入",
      description: "这是可以配置的站点权限。允许当前站点使用剪贴板后，回到这里重试。",
      steps: [
        "点击浏览器地址栏左侧的站点信息图标。",
        "打开“网站设置”或“此网站的权限”。",
        "找到“剪贴板”，将它改为“允许”。",
        "回到 SceneMeld，点击“重试复制”。",
      ],
    };
  }
  if (error.code === "permission-denied") {
    return {
      type: "warning",
      title: "桌面应用没有完成剪贴板写入",
      description: "桌面版通常没有单独的图片剪贴板授权开关，Windows 也没有逐应用的图片剪贴板权限入口。请先重试；仍失败时可重启应用或下载 PNG。",
    };
  }
  if (error.code === "clipboard-busy") {
    return {
      type: "warning",
      title: "系统剪贴板正被其他程序占用",
      description: "请关闭正在监听剪贴板的截图、远程桌面或剪贴板管理工具，等待几秒后再重试。",
    };
  }
  if (error.code === "unsupported") {
    return {
      type: "info",
      title: "当前环境不支持直接复制图片",
      description: desktop
        ? "当前系统或应用版本不支持图片剪贴板。请更新应用，或直接下载 PNG。"
        : "请使用最新版 Chrome 或 Edge，并通过 HTTPS 或 localhost 打开页面；否则请直接下载 PNG。",
    };
  }
  if (error.code === "source-unavailable") {
    return {
      type: "error",
      title: "当前图片文件无法读取",
      description: "图片可能已被浏览器清理或临时链接已经失效。请重新打开这条结果；仍无法读取时需要重新生成。",
    };
  }
  return {
    type: "error",
    title: "系统没有完成图片复制",
    description: "图片结果仍然保留。请先重试一次；如果仍失败，请使用下载 PNG。",
  };
}

const styles = stylex.create({
  title: { display: "inline-flex", alignItems: "center", gap: "8px", color: colors.ink },
  content: { display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" },
  help: {
    padding: "12px 14px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
  steps: { margin: "8px 0 0", paddingLeft: "22px", color: colors.body, lineHeight: 1.7 },
  fallback: { marginBottom: 0 },
  details: { color: colors.muted, fontSize: "12px" },
  footer: { display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "8px" },
});

const MODAL_STYLES = {
  body: { maxHeight: "min(68dvh, 560px)", overflowY: "auto" } satisfies CSSProperties,
};
