import type {
  GenerateImageResponse,
  GenerationRequestSettings,
  ImageAttachmentSource,
} from "../types";

export interface ImageTransport {
  generate(
    settings: GenerationRequestSettings,
    prompt: string,
    signal: AbortSignal,
  ): Promise<GenerateImageResponse>;
  edit(
    settings: GenerationRequestSettings,
    prompt: string,
    attachments: ImageAttachmentSource[],
    signal: AbortSignal,
  ): Promise<GenerateImageResponse>;
}
