export type SceneMeldRuntime = "web" | "desktop";

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getSceneMeldRuntime(): SceneMeldRuntime {
  return isDesktopRuntime() ? "desktop" : "web";
}
