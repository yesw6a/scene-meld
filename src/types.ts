export const IMAGE_MODEL = "gpt-image-2" as const;
export const MAX_IMAGE_BATCH_SIZE = 9;
export const DEFAULT_IMAGE_QUANTITY = 1;
export const IMAGE_BATCH_CONCURRENCY = 3;

export type ImageQuality = "low" | "medium" | "high";
export type ImageSize = "1536x864" | "864x1536" | "1024x1024";
export type ImageRequestSize = ImageSize | "1536x1024" | "1024x1536";
export type ImageOrientation = "landscape" | "portrait" | "square";
export type ConnectionStatus = "incomplete" | "ready" | "requesting" | "success" | "error";

export interface GenerationSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: ImageSize;
  quality: ImageQuality;
  quantity: number;
  rememberApiKey: boolean;
}

export interface GenerationSnapshot {
  model: string;
  size: ImageRequestSize;
  quality: ImageQuality;
  quantity: number;
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
}

export type AssistantStatus = "loading" | "success" | "error" | "aborted";
export type ImageAspectStatus = "matched" | "mismatched" | "unverified" | "retrying";

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
  aspectRetried?: boolean;
  imageId?: string;
  imageDataUrl?: string;
  mimeType?: string;
  revisedPrompt?: string | null;
  source?: "b64_json" | "url";
  error?: string;
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
