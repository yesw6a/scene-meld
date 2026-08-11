const STORAGE_KEY = "gpt-image-2-studio.navigation.v1";

interface StoredNavigationPreferences {
  version: 1;
  collapsed: boolean;
}

export function loadNavigationCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return false;
    }

    const stored = JSON.parse(rawValue) as Partial<StoredNavigationPreferences>;
    return stored.version === 1 && stored.collapsed === true;
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
  } catch {
    // 导航仍可在当前页面使用，本地偏好保存失败不阻断创作。
  }
}
