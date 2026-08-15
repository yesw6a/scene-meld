import { useCallback, type Dispatch, type SetStateAction } from "react";

import { deleteConversationFromWorkspace } from "../lib/workspace-conversations";
import type { WorkspaceSnapshot } from "../types";

interface MessageApi {
  success: (content: string) => unknown;
  warning: (content: string) => unknown;
}

interface UseConversationDeletionOptions {
  workspace: WorkspaceSnapshot | null;
  requestBusy: boolean;
  setWorkspace: Dispatch<SetStateAction<WorkspaceSnapshot | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  clearDraftImages: () => void;
  closeNavigation: () => void;
  toast: MessageApi;
}

export default function useConversationDeletion({
  workspace,
  requestBusy,
  setWorkspace,
  setDraft,
  clearDraftImages,
  closeNavigation,
  toast,
}: UseConversationDeletionOptions) {
  return useCallback(
    (conversationId: string) => {
      if (requestBusy) {
        toast.warning("请先等待当前图片生成完成，或停止生成。");
        return;
      }

      if (!workspace) {
        return;
      }

      const title = workspace.conversations.find(
        (conversation) => conversation.id === conversationId,
      )?.title;
      const result = deleteConversationFromWorkspace(workspace, conversationId);
      if (!result.deleted) {
        return;
      }

      setWorkspace(result.workspace);
      if (result.deletedActive) {
        setDraft("");
        clearDraftImages();
      }
      closeNavigation();
      toast.success(title ? `“${title}”已删除。` : "会话已删除。");
    },
    [
      clearDraftImages,
      closeNavigation,
      requestBusy,
      setDraft,
      setWorkspace,
      toast,
      workspace,
    ],
  );
}
