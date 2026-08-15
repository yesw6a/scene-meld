async function invokeDesktop<Result>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<Result>(command, args);
}

export function loadDesktopApiKey(): Promise<string | null> {
  return invokeDesktop<string | null>("load_api_key");
}

export function saveDesktopApiKey(apiKey: string): Promise<void> {
  return invokeDesktop<void>("save_api_key", { apiKey });
}

export function deleteDesktopApiKey(): Promise<void> {
  return invokeDesktop<void>("delete_api_key");
}
