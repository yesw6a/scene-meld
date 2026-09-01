export const IMAGE_MODEL = "gpt-image-2" as const;
export const DEFAULT_CONVERSATION_MODEL = "gpt-5.6-sol" as const;
export const MAX_IMAGE_BATCH_SIZE = 9;
export const DEFAULT_IMAGE_QUANTITY = 1;
export const IMAGE_BATCH_CONCURRENCY = 3;

export type ImageQuality = "auto" | "low" | "medium" | "high";
export type ImageSize =
  | "auto"
  | "1536x864"
  | "864x1536"
  | "1536x1024"
  | "1024x1536"
  | "1024x1024";
export type ImageRequestSize = "auto" | `${number}x${number}`;
export type ImageOrientation = "auto" | "landscape" | "portrait" | "square";
export type ConnectionStatus = "incomplete" | "ready" | "requesting" | "success" | "error";
export type GenerationMode = "single" | "batch" | "storyboard";

export type GenerationPlan =
  | { mode: "single"; count: 1 }
  | { mode: "batch"; count: number }
  | { mode: "storyboard"; shotCount: number | "auto" };

export type PromptDirectiveKey = "mode" | "size" | "quality" | "quantity";

export interface PromptDirective {
  key: PromptDirectiveKey;
  label: string;
}

export interface PromptSettingsPatch {
  mode?: GenerationMode;
  size?: ImageRequestSize;
  quality?: ImageQuality;
  quantity?: number;
  storyboardQuantity?: number | "auto";
}

export interface PromptDirectiveResult {
  cleanPrompt: string;
  settingsPatch: PromptSettingsPatch;
  directives: PromptDirective[];
  errors: string[];
  errorsByKey: Partial<Record<PromptDirectiveKey, string>>;
}

export type PromptOptimizationRiskLevel = "none" | "review" | "blocked";

export interface PromptOptimizationResult {
  optimizedPrompt: string;
  riskLevel: PromptOptimizationRiskLevel;
  changes: string[];
  notice?: string;
  safetyFindings?: string[];
}

export interface ImagePromptPlan {
  prompts: string[];
}

export interface ConversationPlanningScopes {
  single: boolean;
  batch: boolean;
  storyboard: boolean;
}

export interface ConversationSettings {
  planningScopes: ConversationPlanningScopes;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  rememberApiKey: boolean;
  shareImageConnection: boolean;
}

export interface GenerationSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: ImageSize;
  quality: ImageQuality;
  quantity: number;
  rememberApiKey: boolean;
  mode: GenerationMode;
  storyboardQuantity: number | "auto";
  conversation: ConversationSettings;
}

export interface GenerationSnapshot {
  model: string;
  size: ImageRequestSize;
  quality: ImageQuality;
  quantity: number;
  mode?: GenerationMode;
  storyboardQuantity?: number | "auto";
}

export type GenerationRequestSettings = Omit<GenerationSettings, "size"> & {
  size: ImageRequestSize;
};

export interface MessageImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob?: Blob;
}

export interface ImageAttachmentSource {
  imageId?: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  persisted: boolean;
}

export interface DraftImageAttachment extends ImageAttachmentSource {
  uid: string;
  previewUrl: string;
}

export interface UserMessage {
  id: string;
  type: "user";
  prompt: string;
  createdAt: number;
  batchId?: string;
  attachments?: MessageImageAttachment[];
  storyboardPlan?: StoryboardPlan;
}

export type AssistantStatus = "loading" | "success" | "error" | "aborted";
export type ImageAspectStatus = "matched" | "mismatched" | "unverified";

export interface AssistantMessage {
  id: string;
  type: "assistant";
  prompt: string;
  status: AssistantStatus;
  request: GenerationSnapshot;
  createdAt: number;
  batchId?: string;
  batchIndex?: number;
  batchSize?: number;
  actualWidth?: number;
  actualHeight?: number;
  aspectStatus?: ImageAspectStatus;
  imageId?: string;
  imageDataUrl?: string;
  mimeType?: string;
  revisedPrompt?: string | null;
  source?: "b64_json" | "url";
  error?: string;
  shotId?: string;
  shotIndex?: number;
  shotTitle?: string;
}

export interface CharacterSpec {
  id: string;
  name: string;
  description: string;
}

export interface LocationSpec {
  id: string;
  name: string;
  description: string;
}

export interface StoryboardShot {
  id: string;
  index: number;
  title: string;
  description: string;
  camera: string;
  action: string;
  continuityNotes: string;
  imagePrompt: string;
}

export interface StoryboardPlan {
  id: string;
  sourcePrompt: string;
  styleBible: string;
  characters: CharacterSpec[];
  locations: LocationSpec[];
  shots: StoryboardShot[];
}

export type ChatMessage = UserMessage | AssistantMessage;

export type ConversationTitleMode = "auto" | "manual";

export interface Conversation {
  id: string;
  title: string;
  titleMode: ConversationTitleMode;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceSnapshot {
  conversations: Conversation[];
  activeId: string;
}

export interface GenerateImageResponse {
  image: string;
  mimeType: string;
  revisedPrompt: string | null;
  source: "b64_json" | "url";
}
