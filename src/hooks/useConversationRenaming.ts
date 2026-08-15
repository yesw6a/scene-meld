import { useCallback, type Dispatch, type SetStateAction } from "react";

import { normalizeConversationTitle } from "../lib/conversations";
import type { WorkspaceSnapshot } from "../types";

interface UseConversationRenamingOptions {
  setWorkspace: Dispatch<SetStateAction<WorkspaceSnapshot | null>>;
}

export default function useConversationRenaming({
  setWorkspace,
}: UseConversationRenamingOptions) {
  return useCallback(
    (conversationId: string, rawTitle: string) => {
      const title = normalizeConversationTitle(rawTitle);
      if (!title) {
        return;
      }

      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        const conversationIndex = current.conversations.findIndex(
          (conversation) => conversation.id === conversationId,
        );
        if (conversationIndex < 0) {
          return current;
        }

        const conversations = [...current.conversations];
        conversations[conversationIndex] = {
          ...conversations[conversationIndex],
          title,
          titleMode: "manual",
        };
        return { ...current, conversations };
      });
    },
    [setWorkspace],
  );
}
