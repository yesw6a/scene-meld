import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";

export function updateSourceLabel(snapshot: DesktopUpdateSnapshot): string {
  return snapshot.source === "proxy" ? "gh-proxy 加速源" : "GitHub";
}

export function updateActivityLabel(snapshot: DesktopUpdateSnapshot): string {
  const source = updateSourceLabel(snapshot);
  if (snapshot.status === "checking") {
    return snapshot.retrying ? "GitHub 连接失败，正在尝试 gh-proxy 加速源" : `正在检查更新 · ${source}`;
  }
  if (snapshot.status === "installing") return "正在安装更新，完成后重启";
  if (snapshot.phase === "verifying") return "下载完成，正在校验更新包签名";
  const progress = typeof snapshot.progress === "number"
    ? `${snapshot.progress}%`
    : `已下载 ${((snapshot.downloaded ?? 0) / 1024 / 1024).toFixed(1)} MB`;
  return `${snapshot.retrying ? "直连下载失败，已从加速源重新下载" : `正在下载 · ${source}`} · ${progress}`;
}
