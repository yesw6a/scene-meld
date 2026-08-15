const STORAGE_KEY = "scenemeld.navigation.v1";
const LEGACY_STORAGE_KEY = "gpt-image-2-studio.navigation.v1";

interface StoredNavigationPreferences {
  version: 1;
  collapsed: boolean;
}

export function loadNavigationCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const currentValue = window.localStorage.getItem(STORAGE_KEY);
    const legacyValue = currentValue
      ? null
      : window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const rawValue = currentValue ?? legacyValue;
    if (!rawValue) {
      return false;
    }

    const stored = JSON.parse(rawValue) as Partial<StoredNavigationPreferences>;
    const collapsed = stored.version === 1 && stored.collapsed === true;
    if (legacyValue) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, collapsed } satisfies StoredNavigationPreferences),
        );
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // 保留旧偏好，等待下次本地存储可用时再迁移。
      }
    }
    return collapsed;
  } catch {
    return false;
  }
}

export function saveNavigationCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  const stored: StoredNavigationPreferences = { version: 1, collapsed };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // 导航仍可在当前页面使用，本地偏好保存失败不阻断创作。
  }
}
