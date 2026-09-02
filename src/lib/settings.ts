import {
  DEFAULT_CONVERSATION_MODEL,
  DEFAULT_IMAGE_QUANTITY,
  IMAGE_MODEL,
  type GenerationSettings,
  type ConversationSettings,
  type ConversationPlanningScopes,
  type GenerationMode,
  type ImageQuality,
  type ReasoningEffort,
} from "../types";
import { normalizeImageQuantity } from "./image-batch";
import { migrateImageSize } from "./image-sizes";
import { isDesktopRuntime } from "./runtime";

const STORAGE_KEY = "scenemeld.settings.v1";
const LEGACY_STORAGE_KEY = "gpt-image-2-studio.settings.v1";
const VALID_QUALITIES = new Set<ImageQuality>(["auto", "low", "medium", "high"]);
const VALID_MODES = new Set<GenerationMode>(["single", "batch", "storyboard"]);
const VALID_REASONING_EFFORTS = new Set<ReasoningEffort>(["auto", "low", "medium", "high"]);
const STORYBOARD_QUANTITIES = new Set([3, 4, 6, 9]);

export const DEFAULT_CONVERSATION_SETTINGS: ConversationSettings = {
  planningScopes: {
    single: false,
    batch: false,
    storyboard: true,
  },
  baseUrl: "",
  apiKey: "",
  model: DEFAULT_CONVERSATION_MODEL,
  reasoningEffort: "auto",
  supportsVision: false,
  supportsStructuredOutput: true,
  rememberApiKey: false,
  shareImageConnection: true,
};

export const DEFAULT_SETTINGS: GenerationSettings = {
  baseUrl: "",
  apiKey: "",
  model: IMAGE_MODEL,
  size: "1024x1024",
  quality: "auto",
  quantity: DEFAULT_IMAGE_QUANTITY,
  rememberApiKey: false,
  mode: "single",
  storyboardQuantity: "auto",
  conversation: { ...DEFAULT_CONVERSATION_SETTINGS },
};

type StoredConversationSettings = Partial<
  Omit<ConversationSettings, "planningScopes">
> & {
  planningScopes?: Partial<ConversationPlanningScopes>;
  usageScopes?: {
    storyboard?: unknown;
    promptOptimization?: unknown;
  };
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
  mode?: GenerationMode | "direct" | "variations";
  storyboardQuantity?: number | "auto";
  conversation?: StoredConversationSettings;
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

  const { loadDesktopApiKey, loadDesktopConversationApiKey, saveDesktopApiKey } = await import("./desktop-secrets");
  const [storedApiKey, storedConversationApiKey] = await Promise.all([
    loadDesktopApiKey(),
    loadDesktopConversationApiKey(),
  ]);
  if (storedApiKey || storedConversationApiKey) {
    if (storedApiKey) {
      await saveDesktopApiKey(storedApiKey);
    }
    const hydrated = {
      ...normalizedSettings,
      apiKey: storedApiKey ?? "",
      rememberApiKey: true,
      conversation: normalizedSettings.conversation.shareImageConnection
        ? {
            ...normalizedSettings.conversation,
            baseUrl: normalizedSettings.baseUrl,
            apiKey: storedApiKey ?? "",
            rememberApiKey: true,
          }
        : {
            ...normalizedSettings.conversation,
            apiKey: storedConversationApiKey ?? "",
            rememberApiKey: true,
          },
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
      conversation: normalizedSettings.conversation.shareImageConnection
        ? {
            ...normalizedSettings.conversation,
            baseUrl: normalizedSettings.baseUrl,
            apiKey: migratedApiKey,
          }
        : normalizedSettings.conversation,
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
    const { deleteDesktopApiKey, deleteDesktopConversationApiKey, saveDesktopApiKey, saveDesktopConversationApiKey } = await import("./desktop-secrets");
    if (normalizedSettings.rememberApiKey && normalizedSettings.apiKey) {
      await saveDesktopApiKey(normalizedSettings.apiKey);
    } else {
      await deleteDesktopApiKey();
    }
    if (
      !normalizedSettings.conversation.shareImageConnection &&
      normalizedSettings.rememberApiKey &&
      normalizedSettings.conversation.apiKey
    ) {
      await saveDesktopConversationApiKey(normalizedSettings.conversation.apiKey);
    } else {
      await deleteDesktopConversationApiKey();
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
    const { deleteDesktopApiKey, deleteDesktopConversationApiKey } = await import("./desktop-secrets");
    await Promise.all([deleteDesktopApiKey(), deleteDesktopConversationApiKey()]);
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
    mode: migrateGenerationMode(stored.mode),
    storyboardQuantity:
      stored.storyboardQuantity === "auto"
        ? "auto"
        : typeof stored.storyboardQuantity === "number" && STORYBOARD_QUANTITIES.has(stored.storyboardQuantity)
          ? stored.storyboardQuantity
          : "auto",
    conversation: deserializeConversationSettings(stored.conversation, stored),
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
    mode: settings.mode,
    storyboardQuantity: settings.storyboardQuantity,
    conversation: {
      ...settings.conversation,
      apiKey:
        !isDesktopRuntime() && settings.conversation.rememberApiKey
          ? settings.conversation.apiKey
          : undefined,
    },
    ...(!isDesktopRuntime() && settings.rememberApiKey && settings.apiKey
      ? { apiKey: settings.apiKey }
      : {}),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function normalizeSettings(settings: GenerationSettings): GenerationSettings {
  const source = settings.conversation ?? DEFAULT_CONVERSATION_SETTINGS;
  const conversation: ConversationSettings = {
    planningScopes: normalizeConversationPlanningScopes(source.planningScopes),
    baseUrl: typeof source.baseUrl === "string" ? source.baseUrl : "",
    apiKey: typeof source.apiKey === "string" ? source.apiKey : "",
    model: typeof source.model === "string" && source.model
      ? source.model
      : DEFAULT_CONVERSATION_SETTINGS.model,
    reasoningEffort: normalizeReasoningEffort(source.reasoningEffort),
    supportsVision: source.supportsVision === true,
    supportsStructuredOutput: source.supportsStructuredOutput !== false,
    rememberApiKey: settings.rememberApiKey,
    shareImageConnection: source.shareImageConnection !== false,
  };
  if (conversation.shareImageConnection) {
    conversation.baseUrl = settings.baseUrl;
    conversation.apiKey = settings.apiKey;
  }
  return {
    ...settings,
    model: IMAGE_MODEL,
    quantity: normalizeImageQuantity(settings.quantity),
    mode: VALID_MODES.has(settings.mode) ? settings.mode : "single",
    storyboardQuantity:
      settings.storyboardQuantity === "auto"
        ? "auto"
        : STORYBOARD_QUANTITIES.has(settings.storyboardQuantity)
          ? settings.storyboardQuantity
          : "auto",
    conversation,
  };
}

function deserializeConversationSettings(
  stored: StoredConversationSettings | undefined,
  root: Partial<StoredSettings>,
): ConversationSettings {
  const conversation = stored ?? {};
  const share = conversation.shareImageConnection !== false;
  return {
    planningScopes: normalizeConversationPlanningScopes(
      conversation.planningScopes,
      conversation.usageScopes,
    ),
    baseUrl: share && typeof root.baseUrl === "string" ? root.baseUrl : String(conversation.baseUrl ?? ""),
    apiKey: share
      ? typeof root.apiKey === "string"
        ? root.apiKey
        : ""
      : typeof conversation.apiKey === "string"
        ? conversation.apiKey
        : "",
    model: typeof conversation.model === "string" && conversation.model ? conversation.model : DEFAULT_CONVERSATION_SETTINGS.model,
    reasoningEffort: normalizeReasoningEffort(conversation.reasoningEffort),
    supportsVision: conversation.supportsVision === true,
    supportsStructuredOutput: conversation.supportsStructuredOutput !== false,
    rememberApiKey: root.rememberApiKey === true || conversation.rememberApiKey === true,
    shareImageConnection: share,
  };
}

function normalizeReasoningEffort(value: unknown): ReasoningEffort {
  return VALID_REASONING_EFFORTS.has(value as ReasoningEffort)
    ? value as ReasoningEffort
    : "auto";
}

function normalizeConversationPlanningScopes(
  value: unknown,
  legacyUsageScopes?: StoredConversationSettings["usageScopes"],
): ConversationPlanningScopes {
  if (!value || typeof value !== "object") {
    return {
      single: false,
      batch: false,
      storyboard: legacyUsageScopes?.storyboard !== false,
    };
  }
  const scopes = value as Partial<ConversationPlanningScopes>;
  return {
    single: scopes.single === true,
    batch: scopes.batch === true,
    storyboard: scopes.storyboard !== false,
  };
}

function removeLegacySettings(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

function migrateGenerationMode(value: unknown): GenerationMode {
  if (value === "direct") return "single";
  if (value === "variations") return "batch";
  return VALID_MODES.has(value as GenerationMode) ? (value as GenerationMode) : "single";
}
