import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as stylex from "@stylexjs/stylex";
import { Actions, Bubble } from "@ant-design/x";
import { App as AntdApp, Button, Image, Tooltip } from "antd";
import {
  AlertCircle,
  Copy,
  Download,
  Image as ImageIcon,
  OctagonX,
  PencilLine,
  RefreshCw,
  Trash2,
  WandSparkles,
} from "lucide-react";

import { imagePreviewSizing } from "../lib/image-sizes";
import type { AssistantMessage, ChatMessage, UserMessage } from "../types";
import { colors, materials, motion, radii, shadows } from "../styles/tokens.stylex";
import ImageResultCard from "./ImageResultCard";
import UserMessageContent from "./UserMessageContent";

interface MessageFeedProps {
  conversationId: string;
  messages: ChatMessage[];
  busy: boolean;
  onCopy: (text: string) => void;
  onDownload: (message: AssistantMessage) => void | Promise<void>;
  onRegenerate: (message: AssistantMessage, source?: UserMessage) => void;
  onEditPrompt: (message: UserMessage) => void;
  onContinueEditing: (message: AssistantMessage) => void;
  onDelete: (messageIds: string[]) => void;
}

interface MessageTurn {
  id: string;
  user?: UserMessage;
  assistant?: AssistantMessage;
  messageIds: string[];
}

interface MessageActionsProps {
  messageIds: string[];
  busy: boolean;
  onDelete: (messageIds: string[]) => void;
}

export default function MessageFeed({
  conversationId,
  messages,
  busy,
  onCopy,
  onDownload,
  onRegenerate,
  onEditPrompt,
  onContinueEditing,
  onDelete,
}: MessageFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages.at(-1);
  const turns = groupMessageTurns(messages);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages.length, lastMessage?.type === "assistant" ? lastMessage.status : undefined]);

  return (
    <div {...stylex.props(styles.root)} aria-live="polite">
      <div {...stylex.props(styles.list)}>
        <Image.PreviewGroup
          key={conversationId}
          preview={{ countRender: (current, total) => `第 ${current} / ${total} 张` }}
        >
          {turns.map((turn) => (
            <section key={turn.id} {...stylex.props(styles.turn)} aria-label="一轮图片生成对话">
              {turn.user ? (
                <div {...stylex.props(styles.userRow)}>
                  <Bubble
                    placement="end"
                    shape="corner"
                    variant="filled"
                    content={<UserMessageContent message={turn.user} />}
                    footerPlacement="outer-end"
                    footer={
                      <UserMessageActions
                        message={turn.user}
                        messageIds={turn.messageIds}
                        busy={busy}
                        onCopy={onCopy}
                        onEditPrompt={onEditPrompt}
                        onDelete={onDelete}
                      />
                    }
                    classNames={{
                      content: stylex.props(styles.userBubble).className ?? "",
                      footer: stylex.props(styles.userFooter).className ?? "",
                    }}
                  />
                </div>
              ) : null}

              {turn.assistant ? (
                <AssistantMessageView
                  message={turn.assistant}
                  messageIds={turn.messageIds}
                  busy={busy}
                  onDownload={onDownload}
                  onRegenerate={onRegenerate}
                  onContinueEditing={onContinueEditing}
                  onDelete={onDelete}
                  source={turn.user}
                />
              ) : null}
            </section>
          ))}
        </Image.PreviewGroup>
        <div ref={endRef} {...stylex.props(styles.endSentinel)} />
      </div>
    </div>
  );
}

function UserMessageActions({
  message,
  messageIds,
  busy,
  onCopy,
  onEditPrompt,
  onDelete,
}: MessageActionsProps & {
  message: UserMessage;
  onCopy: (text: string) => void;
  onEditPrompt: (message: UserMessage) => void;
}) {
  return (
    <Actions
      variant="borderless"
      aria-label="用户消息操作"
      classNames={{ item: stylex.props(styles.actionItem).className ?? "" }}
      items={[
        {
          key: "copy-prompt",
          label: "复制提示词",
          icon: <Copy size={15} />,
          onItemClick: () => onCopy(message.prompt),
        },
        {
          key: "edit-prompt",
          label: "编辑提示词",
          icon: <PencilLine size={15} />,
          onItemClick: () => onEditPrompt(message),
        },
        {
          key: "delete-turn",
          label: "删除这轮对话",
          danger: true,
          actionRender: (
            <DeleteTurnAction
              messageIds={messageIds}
              busy={busy}
              onDelete={onDelete}
            />
          ),
        },
      ]}
    />
  );
}

function AssistantMessageView({
  message,
  messageIds,
  busy,
  onDownload,
  onRegenerate,
  onContinueEditing,
  onDelete,
  source,
}: Omit<
  MessageFeedProps,
  "messages" | "conversationId" | "onCopy" | "onEditPrompt"
> & {
  message: AssistantMessage;
  messageIds: string[];
  source?: UserMessage;
}) {
  return (
    <div {...stylex.props(styles.assistantRow)}>
      <Bubble<ReactNode>
        placement="start"
        variant="borderless"
        content={<AssistantMessageContent message={message} />}
        footerPlacement="outer-start"
        footer={
          <AssistantMessageActions
            message={message}
            messageIds={messageIds}
            busy={busy}
            onDownload={onDownload}
            onRegenerate={onRegenerate}
            onContinueEditing={onContinueEditing}
            onDelete={onDelete}
            source={source}
          />
        }
        rootClassName={stylex.props(styles.assistantBubble).className}
        classNames={{
          content: stylex.props(styles.assistantBubbleContent).className ?? "",
          footer: stylex.props(styles.assistantFooter).className ?? "",
        }}
      />
    </div>
  );
}

function AssistantMessageContent({ message }: { message: AssistantMessage }) {
  if (message.status === "loading") {
    const previewSizing = imagePreviewSizing(message.request.size);

    return (
      <div {...stylex.props(styles.loadingCard)} aria-label="正在生成图片">
        <div
          {...stylex.props(styles.loadingCanvas)}
          style={previewSizingStyle(previewSizing)}
        >
          <span {...stylex.props(styles.loadingIcon)}>
            <ImageIcon size={24} aria-hidden="true" />
          </span>
        </div>
        <div {...stylex.props(styles.loadingCopy)}>
          <strong>正在构图与渲染</strong>
          <span>图片生成可能需要数十秒，请保持页面打开。</span>
        </div>
      </div>
    );
  }

  if (message.status === "error" || message.status === "aborted") {
    const aborted = message.status === "aborted";
    return (
      <div
        {...stylex.props(styles.errorCard, aborted && styles.abortedCard)}
        role={aborted ? "status" : "alert"}
      >
        <div {...stylex.props(styles.errorCopy)}>
          {aborted ? (
            <OctagonX size={20} aria-hidden="true" />
          ) : (
            <AlertCircle size={20} aria-hidden="true" />
          )}
          <div>
            <strong>{aborted ? "已停止生成" : "生成失败"}</strong>
            <p>{message.error}</p>
          </div>
        </div>
      </div>
    );
  }

  return <ImageResultCard message={message} />;
}

function AssistantMessageActions({
  message,
  messageIds,
  busy,
  onDownload,
  onRegenerate,
  onContinueEditing,
  onDelete,
  source,
}: MessageActionsProps & {
  message: AssistantMessage;
  onDownload: (message: AssistantMessage) => void | Promise<void>;
  onRegenerate: (message: AssistantMessage, source?: UserMessage) => void;
  onContinueEditing: (message: AssistantMessage) => void;
  source?: UserMessage;
}) {
  const loading = message.status === "loading";
  const imageReady = message.status === "success";

  return (
    <Actions
      variant="borderless"
      aria-label="生成结果操作"
      classNames={{ item: stylex.props(styles.actionItem).className ?? "" }}
      items={[
        {
          key: "download-image",
          label: "下载图片",
          icon: <Download size={15} />,
          onItemClick: imageReady ? () => void onDownload(message) : undefined,
          actionRender: imageReady ? undefined : (
            <ActionButton icon={<Download size={15} />} label="下载图片" disabled />
          ),
        },
        {
          key: "continue-editing",
          label: "继续修改",
          icon: <WandSparkles size={15} />,
          onItemClick:
            imageReady && !busy ? () => onContinueEditing(message) : undefined,
          actionRender:
            imageReady && !busy ? undefined : (
              <ActionButton icon={<WandSparkles size={15} />} label="继续修改" disabled />
            ),
        },
        {
          key: "regenerate",
          label: "重新生成",
          icon: <RefreshCw size={15} />,
          onItemClick:
            !busy && !loading ? () => onRegenerate(message, source) : undefined,
          actionRender:
            !busy && !loading ? undefined : (
              <ActionButton icon={<RefreshCw size={15} />} label="重新生成" disabled />
            ),
        },
        {
          key: "delete-turn",
          label: "删除这轮对话",
          danger: true,
          actionRender: (
            <DeleteTurnAction
              messageIds={messageIds}
              busy={busy}
              onDelete={onDelete}
            />
          ),
        },
      ]}
    />
  );
}

function ActionButton({
  icon,
  label,
  ariaLabel = label,
  disabled = false,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  const button = (
    <Button
      type="text"
      size="small"
      icon={icon}
      danger={danger}
      disabled={disabled}
      aria-label={ariaLabel}
      className={stylex.props(
        styles.actionButton,
        danger && styles.actionButtonDanger,
      ).className}
      onClick={onClick}
    />
  );

  return (
    <Tooltip title={label} mouseEnterDelay={0.35}>
      {button}
    </Tooltip>
  );
}

function DeleteTurnAction({ messageIds, busy, onDelete }: MessageActionsProps) {
  const { modal } = AntdApp.useApp();

  const confirmDelete = () => {
    modal.confirm({
      title: "删除这轮对话？",
      content: "用户提示词、模型回复和本地图片都会删除；应用内无法撤销。",
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      centered: true,
      mask: { closable: false },
      onOk: () => onDelete(messageIds),
    });
  };

  return (
    <ActionButton
      icon={<Trash2 size={15} />}
      label="删除"
      ariaLabel="删除这轮对话"
      danger
      disabled={busy}
      onClick={confirmDelete}
    />
  );
}

function groupMessageTurns(messages: ChatMessage[]): MessageTurn[] {
  const turns: MessageTurn[] = [];

  for (const message of messages) {
    const latest = turns.at(-1);
    if (message.type === "user") {
      turns.push({ id: message.id, user: message, messageIds: [message.id] });
      continue;
    }

    if (latest?.user && !latest.assistant) {
      latest.assistant = message;
      latest.messageIds.push(message.id);
      continue;
    }

    turns.push({ id: message.id, assistant: message, messageIds: [message.id] });
  }

  return turns;
}

function previewSizingStyle(sizing: ReturnType<typeof imagePreviewSizing>): CSSProperties {
  return {
    "--preview-desktop-width": `${sizing.desktopWidth}px`,
    "--preview-mobile-width": `${sizing.mobileWidth}px`,
    "--preview-aspect-ratio": sizing.aspectRatio,
  } as CSSProperties;
}

const pulse = stylex.keyframes({
  "0%, 100%": { opacity: 0.45 },
  "50%": { opacity: 1 },
});

const enterTurn = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(8px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const shimmer = stylex.keyframes({
  from: { transform: "translateX(-115%)" },
  to: { transform: "translateX(115%)" },
});

const styles = stylex.create({
  root: {
    minHeight: "100%",
    padding: "32px 24px",
    "@media (max-width: 767px)": {
      padding: "24px 14px 28px",
    },
  },
  list: {
    width: "min(1200px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: "38px",
    margin: "0 auto",
  },
  turn: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "22px",
    animationName: enterTurn,
    animationDuration: motion.slow,
    animationTimingFunction: motion.easing,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  userRow: {
    minWidth: 0,
    display: "flex",
    justifyContent: "flex-end",
  },
  userBubble: {
    maxWidth: "min(720px, 82vw)",
    padding: "12px 16px",
    color: colors.ink,
    fontSize: "15px",
    lineHeight: 1.65,
    backgroundColor: colors.userBubble,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.userBubbleBorder,
    borderRadius: radii.large,
    WebkitBackdropFilter: materials.subtle,
    backdropFilter: materials.subtle,
  },
  userFooter: {
    display: "flex",
    justifyContent: "flex-end",
  },
  assistantRow: {
    width: "100%",
    minWidth: 0,
    display: "flex",
    justifyContent: "flex-start",
  },
  assistantBubble: {
    width: "100%",
    minWidth: 0,
  },
  assistantBubbleContent: {
    width: "100%",
    maxWidth: "100%",
    padding: 0,
    backgroundColor: "transparent",
  },
  assistantFooter: {
    display: "flex",
    justifyContent: "flex-start",
  },
  actionItem: {
    color: colors.muted,
    borderRadius: radii.small,
    transitionProperty: "color, background-color, transform",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    ":active": {
      color: colors.primaryPressed,
      backgroundColor: colors.primarySoftHover,
      transform: "scale(0.94)",
    },
    "@media (pointer: coarse)": {
      width: "40px",
      height: "40px",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
  },
  actionButton: {
    width: "30px",
    minWidth: "30px",
    height: "30px",
    padding: 0,
    color: colors.muted,
    borderRadius: radii.small,
    transitionProperty: "color, background-color, transform, box-shadow, opacity",
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.easing,
    ":hover": {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    ":active": {
      color: colors.primaryPressed,
      backgroundColor: colors.primarySoftHover,
      transform: "scale(0.97)",
    },
    ":focus-visible": {
      boxShadow: shadows.focus,
    },
    ":disabled": {
      opacity: 0.42,
      transform: "none",
    },
    "@media (prefers-reduced-motion: reduce)": {
      transitionDuration: "0ms",
      transform: "none",
    },
    "@media (pointer: coarse)": {
      width: "40px",
      minWidth: "40px",
      height: "40px",
    },
  },
  actionButtonDanger: {
    color: colors.danger,
    ":hover": {
      color: colors.dangerHover,
      backgroundColor: colors.dangerSoft,
    },
    ":active": {
      color: colors.dangerHover,
      backgroundColor: colors.dangerSoftHover,
    },
  },
  loadingCard: {
    width: "100%",
    minWidth: 0,
  },
  loadingCanvas: {
    position: "relative",
    width: "var(--preview-desktop-width)",
    maxWidth: "100%",
    aspectRatio: "var(--preview-aspect-ratio)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    color: colors.onDarkMuted,
    backgroundColor: colors.dark,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.large,
    "::after": {
      content: "",
      position: "absolute",
      inset: 0,
      backgroundImage:
        "linear-gradient(105deg, transparent 34%, rgba(255, 255, 255, 0.12) 49%, transparent 64%)",
      transform: "translateX(-115%)",
      animationName: shimmer,
      animationDuration: "1.8s",
      animationTimingFunction: "ease-in-out",
      animationIterationCount: "infinite",
      pointerEvents: "none",
    },
    "@media (max-width: 767px)": {
      width: "var(--preview-mobile-width)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      "::after": {
        display: "none",
      },
    },
  },
  loadingIcon: {
    position: "relative",
    zIndex: 1,
    width: "54px",
    height: "54px",
    display: "grid",
    placeItems: "center",
    backgroundColor: colors.darkRaised,
    borderRadius: radii.large,
    animationName: pulse,
    animationDuration: "1.4s",
    animationIterationCount: "infinite",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  loadingCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingTop: "14px",
    color: colors.ink,
    fontSize: "14px",
  },
  errorCard: {
    width: "min(720px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "18px",
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.danger,
    borderRadius: radii.large,
  },
  errorCopy: {
    display: "flex",
    gap: "12px",
  },
  abortedCard: {
    color: colors.muted,
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
  },
  endSentinel: {
    scrollMarginBottom: "24px",
  },
});
