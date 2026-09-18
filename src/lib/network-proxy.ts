export type ProxyMode = "system" | "none" | "manual";

export interface ProxySettings {
  mode: ProxyMode;
  url: string;
}

export const DEFAULT_PROXY_SETTINGS: ProxySettings = { mode: "system", url: "" };

export async function loadProxySettings(): Promise<ProxySettings> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProxySettings>("load_proxy_settings");
}

export async function saveProxySettings(settings: ProxySettings): Promise<ProxySettings> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProxySettings>("save_proxy_settings", { settings });
}

export function proxyErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return typeof error === "string" ? error : "无法访问代理设置，请重试。";
}
