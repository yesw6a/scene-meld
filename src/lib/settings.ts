import {
  DEFAULT_IMAGE_QUANTITY,
  IMAGE_MODEL,
  type GenerationSettings,
  type ImageQuality,
} from "../types";
import { normalizeImageQuantity } from "./image-batch";
import { migrateImageSize } from "./image-sizes";
import { isDesktopRuntime } from "./runtime";

const STORAGE_KEY = "scenemeld.settings.v1";
const LEGACY_STORAGE_KEY = "gpt-image-2-studio.settings.v1";
const VALID_QUALITIES = new Set<ImageQuality>(["low", "medium", "high"]);

export const DEFAULT_SETTINGS: GenerationSettings = {
  baseUrl: "",
  apiKey: "",
  model: IMAGE_MODEL,
  size: "1024x1024",
  quality: "medium",
  quantity: DEFAULT_IMAGE_QUANTITY,
  rememberApiKey: false,
};

interface StoredSettings {
  version: 1;
  baseUrl: string;
  model: string;
  size: string;
  quality: ImageQuality;
  quantity?: number;
  rememberApiKey: boolean;
  apiKey?: string;
}

let cachedSettings: GenerationSettings | null = null;
let pendingLegacyDesktopApiKey: string | null = null;

export function loadSettings(): GenerationSettings {
  if (cachedSettings) {
    return cachedSettings;
  }
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const currentValue = window.localStorage.getItem(STORAGE_KEY);
    const legacyValue = currentValue
      ? null
      : window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const rawValue = currentValue ?? legacyValue;
    if (!rawValue) {
      cachedSettings = { ...DEFAULT_SETTINGS };
      return cachedSettings;
    }

    const stored = JSON.parse(rawValue) as Partial<StoredSettings>;
    const desktop = isDesktopRuntime();
    const legacyApiKey =
      legacyValue &&
      desktop &&
      stored.rememberApiKey === true &&
      typeof stored.apiKey === "string"
        ? stored.apiKey
        : "";
    pendingLegacyDesktopApiKey = legacyApiKey || null;
    cachedSettings = deserializeSettings(stored, desktop);

    if (!pendingLegacyDesktopApiKey) {
      try {
        persistLocalPreferences(cachedSettings);
        if (legacyValue) {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      } catch {
        // 读取到的设置仍可用于当前会话，迁移留到下次存储可用时重试。
      }
    }
    return cachedSettings;
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
}

export async function hydrateSettingsApiKey(
  settings: GenerationSettings,
): Promise<GenerationSettings> {
  const normalizedSettings = normalizeSettings(settings);
  if (!isDesktopRuntime()) {
    cachedSettings = normalizedSettings;
    return normalizedSettings;
  }

  const { loadDesktopApiKey, saveDesktopApiKey } = await import("./desktop-secrets");
  const storedApiKey = await loadDesktopApiKey();
  if (storedApiKey) {
    const hydrated = {
      ...normalizedSettings,
      apiKey: storedApiKey,
      rememberApiKey: true,
    };
    cachedSettings = hydrated;
    persistLocalPreferences(hydrated);
    removeLegacySettings();
    pendingLegacyDesktopApiKey = null;
    return hydrated;
  }

  if (pendingLegacyDesktopApiKey) {
    const migratedApiKey = pendingLegacyDesktopApiKey;
    await saveDesktopApiKey(migratedApiKey);
    const hydrated = {
      ...normalizedSettings,
      apiKey: migratedApiKey,
      rememberApiKey: true,
    };
    cachedSettings = hydrated;
    persistLocalPreferences(hydrated);
    removeLegacySettings();
    pendingLegacyDesktopApiKey = null;
    return hydrated;
  }

  cachedSettings = { ...normalizedSettings, apiKey: "" };
  persistLocalPreferences(cachedSettings);
  removeLegacySettings();
  return cachedSettings;
}

export async function saveSettings(settings: GenerationSettings): Promise<void> {
  const normalizedSettings = normalizeSettings(settings);
  if (isDesktopRuntime()) {
    const { deleteDesktopApiKey, saveDesktopApiKey } = await import("./desktop-secrets");
    if (normalizedSettings.rememberApiKey && normalizedSettings.apiKey) {
      await saveDesktopApiKey(normalizedSettings.apiKey);
    } else {
      await deleteDesktopApiKey();
    }
  }

  cachedSettings = normalizedSettings;
  persistLocalPreferences(normalizedSettings);
  removeLegacySettings();
  pendingLegacyDesktopApiKey = null;
}

export function saveSettingsPreferences(settings: GenerationSettings): void {
  const normalizedSettings = normalizeSettings(settings);
  cachedSettings = normalizedSettings;
  persistLocalPreferences(normalizedSettings);
}

export async function clearStoredSettings(): Promise<GenerationSettings> {
  if (isDesktopRuntime()) {
    const { deleteDesktopApiKey } = await import("./desktop-secrets");
    await deleteDesktopApiKey();
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  pendingLegacyDesktopApiKey = null;
  cachedSettings = { ...DEFAULT_SETTINGS };
  return cachedSettings;
}

function deserializeSettings(
  stored: Partial<StoredSettings>,
  desktop: boolean,
): GenerationSettings {
  return {
    baseUrl: typeof stored.baseUrl === "string" ? stored.baseUrl : "",
    apiKey:
      !desktop && stored.rememberApiKey && typeof stored.apiKey === "string"
        ? stored.apiKey
        : "",
    model: IMAGE_MODEL,
    size: migrateImageSize(stored.size),
    quality: VALID_QUALITIES.has(stored.quality as ImageQuality)
      ? (stored.quality as ImageQuality)
      : "medium",
    quantity: normalizeImageQuantity(stored.quantity),
    rememberApiKey: stored.rememberApiKey === true,
  };
}

function persistLocalPreferences(settings: GenerationSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  const stored: StoredSettings = {
    version: 1,
    baseUrl: settings.baseUrl,
    model: IMAGE_MODEL,
    size: settings.size,
    quality: settings.quality,
    quantity: normalizeImageQuantity(settings.quantity),
    rememberApiKey: settings.rememberApiKey,
    ...(!isDesktopRuntime() && settings.rememberApiKey && settings.apiKey
      ? { apiKey: settings.apiKey }
      : {}),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function normalizeSettings(settings: GenerationSettings): GenerationSettings {
  return {
    ...settings,
    model: IMAGE_MODEL,
    quantity: normalizeImageQuantity(settings.quantity),
  };
}

function removeLegacySettings(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
