import type { GenerationSettings, ImageQuality, ImageSize } from "../types";
import { migrateImageSize } from "./image-sizes";

const STORAGE_KEY = "gpt-image-2-studio.settings.v1";
const VALID_QUALITIES = new Set<ImageQuality>(["low", "medium", "high"]);

export const DEFAULT_SETTINGS: GenerationSettings = {
  baseUrl: "",
  apiKey: "",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  rememberApiKey: false,
};

interface StoredSettings {
  version: 1;
  baseUrl: string;
  model: string;
  size: string;
  quality: ImageQuality;
  rememberApiKey: boolean;
  apiKey?: string;
}

let cachedSettings: GenerationSettings | null = null;

export function loadSettings(): GenerationSettings {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      cachedSettings = DEFAULT_SETTINGS;
      return cachedSettings;
    }

    const stored = JSON.parse(rawValue) as Partial<StoredSettings>;
    cachedSettings = {
      baseUrl: typeof stored.baseUrl === "string" ? stored.baseUrl : "",
      apiKey:
        stored.rememberApiKey && typeof stored.apiKey === "string" ? stored.apiKey : "",
      model: typeof stored.model === "string" && stored.model ? stored.model : "gpt-image-2",
      size: migrateImageSize(stored.size),
      quality: VALID_QUALITIES.has(stored.quality as ImageQuality)
        ? (stored.quality as ImageQuality)
        : "medium",
      rememberApiKey: stored.rememberApiKey === true,
    };
    return cachedSettings;
  } catch {
    cachedSettings = DEFAULT_SETTINGS;
    return cachedSettings;
  }
}

export function saveSettings(settings: GenerationSettings): void {
  cachedSettings = settings;

  if (typeof window === "undefined") {
    return;
  }

  const stored: StoredSettings = {
    version: 1,
    baseUrl: settings.baseUrl,
    model: settings.model,
    size: settings.size,
    quality: settings.quality,
    rememberApiKey: settings.rememberApiKey,
    ...(settings.rememberApiKey && settings.apiKey ? { apiKey: settings.apiKey } : {}),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearStoredSettings(): GenerationSettings {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  cachedSettings = { ...DEFAULT_SETTINGS };
  return cachedSettings;
}
