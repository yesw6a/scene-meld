import { openDB, type DBSchema } from "idb";

import { restoreLegacyConversationTitle } from "./conversations";
import type {
  AssistantMessage,
  ChatMessage,
  Conversation,
  MessageImageAttachment,
  UserMessage,
  WorkspaceSnapshot,
} from "../types";

const DATABASE_NAME = "gpt-image-2-studio";
const DATABASE_VERSION = 1;
const ACTIVE_CONVERSATION_KEY = "active-conversation";

type StoredAssistantMessage = Omit<AssistantMessage, "imageDataUrl">;
type StoredMessageImageAttachment = Omit<MessageImageAttachment, "blob">;
type StoredUserMessage = Omit<UserMessage, "attachments"> & {
  attachments?: StoredMessageImageAttachment[];
};
type StoredChatMessage = StoredUserMessage | StoredAssistantMessage;

interface StoredConversation extends Omit<Conversation, "messages"> {
  messages: StoredChatMessage[];
}

interface StoredImage {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

interface StoredMeta {
  key: string;
  value: string;
}

interface StudioDatabase extends DBSchema {
  conversations: {
    key: string;
    value: StoredConversation;
  };
  images: {
    key: string;
    value: StoredImage;
  };
  meta: {
    key: string;
    value: StoredMeta;
  };
}

const databasePromise = openDB<StudioDatabase>(DATABASE_NAME, DATABASE_VERSION, {
  upgrade(database) {
    database.createObjectStore("conversations", { keyPath: "id" });
    database.createObjectStore("images", { keyPath: "id" });
    database.createObjectStore("meta", { keyPath: "key" });
  },
});

export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  const database = await databasePromise;
  const [storedConversations, activeMeta] = await Promise.all([
    database.getAll("conversations"),
    database.get("meta", ACTIVE_CONVERSATION_KEY),
  ]);

  if (storedConversations.length === 0) {
    return null;
  }

  const conversations = storedConversations
    .map(restoreConversation)
    .sort((first, second) => second.updatedAt - first.updatedAt);
  const activeId = conversations.some((item) => item.id === activeMeta?.value)
    ? activeMeta!.value
    : conversations[0].id;

  return { conversations, activeId };
}

export async function saveWorkspace(workspace: WorkspaceSnapshot): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(
    ["conversations", "images", "meta"],
    "readwrite",
  );
  const conversationStore = transaction.objectStore("conversations");
  const imageStore = transaction.objectStore("images");
  const existingConversations = await conversationStore.getAll();
  const currentIds = new Set(workspace.conversations.map((item) => item.id));
  const storedConversations = workspace.conversations.map(toStoredConversation);
  const currentImageIds = imageIdsFromConversations(storedConversations);
  const previousImageIds = imageIdsFromConversations(existingConversations);

  for (const storedConversation of storedConversations) {
    await conversationStore.put(storedConversation);
  }

  for (const conversation of existingConversations) {
    if (currentIds.has(conversation.id)) {
      continue;
    }

    await conversationStore.delete(conversation.id);
  }

  for (const imageId of previousImageIds) {
    if (!currentImageIds.has(imageId)) {
      await imageStore.delete(imageId);
    }
  }

  await transaction.objectStore("meta").put({
    key: ACTIVE_CONVERSATION_KEY,
    value: workspace.activeId,
  });
  await transaction.done;
}

export async function saveGeneratedImage(
  id: string,
  blob: Blob,
  mimeType: string,
  createdAt: number,
): Promise<void> {
  const database = await databasePromise;
  await database.put("images", { id, blob, mimeType, createdAt });
}

export async function loadGeneratedImage(id: string): Promise<Blob | null> {
  const database = await databasePromise;
  return (await database.get("images", id))?.blob ?? null;
}

export async function clearWorkspaceData(): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(
    ["conversations", "images", "meta"],
    "readwrite",
  );

  await Promise.all([
    transaction.objectStore("conversations").clear(),
    transaction.objectStore("images").clear(),
    transaction.objectStore("meta").clear(),
  ]);
  await transaction.done;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function toStoredConversation(conversation: Conversation): StoredConversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => {
      if (message.type === "user") {
        return {
          ...message,
          attachments: message.attachments?.map(
            ({ blob: _blob, ...attachment }) => attachment,
          ),
        };
      }

      const { imageDataUrl: _imageDataUrl, ...storedMessage } = message;
      return storedMessage;
    }),
  };
}

function restoreConversation(conversation: StoredConversation): Conversation {
  let interrupted = false;
  const messages = conversation.messages.map((message): ChatMessage => {
    if (message.type !== "assistant" || message.status !== "loading") {
      return message;
    }

    interrupted = true;
    return {
      ...message,
      status: "aborted",
      error: "页面刷新后，未完成的生成请求已中断。",
    };
  });

  return {
    ...conversation,
    title: restoreLegacyConversationTitle(
      conversation.title,
      messages.find((message) => message.type === "user")?.prompt,
    ),
    messages,
    updatedAt: interrupted ? Date.now() : conversation.updatedAt,
  };
}

function imageIdsFromMessages(messages: StoredChatMessage[]): Set<string> {
  const imageIds = new Set<string>();

  for (const message of messages) {
    if (message.type === "assistant" && message.imageId) {
      imageIds.add(message.imageId);
      continue;
    }

    if (message.type === "user") {
      for (const attachment of message.attachments ?? []) {
        imageIds.add(attachment.id);
      }
    }
  }

  return imageIds;
}

function imageIdsFromConversations(conversations: StoredConversation[]): Set<string> {
  const imageIds = new Set<string>();

  for (const conversation of conversations) {
    for (const imageId of imageIdsFromMessages(conversation.messages)) {
      imageIds.add(imageId);
    }
  }

  return imageIds;
}
