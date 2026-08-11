import { createConversation } from "./conversations";
import type { WorkspaceSnapshot } from "../types";

export interface DeleteConversationResult {
  workspace: WorkspaceSnapshot;
  deleted: boolean;
  deletedActive: boolean;
}

export function deleteConversationFromWorkspace(
  workspace: WorkspaceSnapshot,
  conversationId: string,
): DeleteConversationResult {
  const targetIndex = workspace.conversations.findIndex(
    (conversation) => conversation.id === conversationId,
  );

  if (targetIndex < 0) {
    return { workspace, deleted: false, deletedActive: false };
  }

  const deletedActive = workspace.activeId === conversationId;
  const conversations = workspace.conversations.filter(
    (conversation) => conversation.id !== conversationId,
  );

  if (conversations.length === 0) {
    const replacement = createConversation();
    return {
      workspace: { conversations: [replacement], activeId: replacement.id },
      deleted: true,
      deletedActive,
    };
  }

  const activeId = deletedActive
    ? (conversations[targetIndex] ?? conversations[targetIndex - 1]).id
    : workspace.activeId;

  return {
    workspace: { conversations, activeId },
    deleted: true,
    deletedActive,
  };
}
