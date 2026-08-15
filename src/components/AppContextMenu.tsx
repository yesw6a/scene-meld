import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App as AntdApp, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { ClipboardPaste, Copy, ListChecks, Scissors } from "lucide-react";

import {
  captureEditableContextMenuTarget,
  replaceEditableContextMenuSelection,
  selectAllEditableContextMenuTarget,
  type EditableContextMenuTarget,
} from "../lib/editable-context-menu";

export interface ContextMenuAction {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void | Promise<void>;
}

export interface ContextMenuDivider {
  type: "divider";
  key?: string;
}

export type ContextMenuEntry = ContextMenuAction | ContextMenuDivider;

interface ContextMenuRegistry {
  registerTarget: (element: HTMLElement, entries: ContextMenuEntry[]) => () => void;
}

interface ContextMenuState {
  entries: ContextMenuEntry[];
  x: number;
  y: number;
}

const ContextMenuRegistryContext = createContext<ContextMenuRegistry | null>(null);

export default function AppContextMenu({ children }: { children: ReactNode }) {
  const { message: toast } = AntdApp.useApp();
  const targetRegistry = useRef(new WeakMap<HTMLElement, ContextMenuEntry[]>());
  const [menuState, setMenuState] = useState<ContextMenuState | null>(null);
  const isMenuOpen = Boolean(menuState);

  const closeMenu = useCallback(() => setMenuState(null), []);

  const registerTarget = useCallback(
    (element: HTMLElement, entries: ContextMenuEntry[]) => {
      targetRegistry.current.set(element, entries);
      return () => targetRegistry.current.delete(element);
    },
    [],
  );

  const copyText = useCallback(
    async (text: string, successMessage: string | null = "已复制。") => {
      if (!navigator.clipboard?.writeText) {
        toast.error("当前环境不支持复制。");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        if (successMessage) {
          toast.success(successMessage);
        }
        return true;
      } catch {
        toast.error("复制失败，请使用键盘快捷键。");
        return false;
      }
    },
    [toast],
  );

  const editableEntries = useCallback(
    (target: EditableContextMenuTarget): ContextMenuEntry[] => {
      const hasSelection = target.selectedText.length > 0;
      const canCopy = Boolean(navigator.clipboard?.writeText);
      const canPaste = Boolean(navigator.clipboard?.readText);

      return [
        {
          key: "cut",
          label: "剪切",
          icon: <Scissors size={16} aria-hidden="true" />,
          disabled: !target.editable || !hasSelection || !canCopy,
          onSelect: async () => {
            const copied = await copyText(target.selectedText, null);
            if (!copied) {
              return;
            }

            replaceEditableContextMenuSelection(target, "");
            toast.success("已剪切。");
          },
        },
        {
          key: "copy",
          label: "复制",
          icon: <Copy size={16} aria-hidden="true" />,
          disabled: !hasSelection || !canCopy,
          onSelect: async () => {
            await copyText(target.selectedText);
          },
        },
        {
          key: "paste",
          label: "粘贴",
          icon: <ClipboardPaste size={16} aria-hidden="true" />,
          disabled: !target.editable || !canPaste,
          onSelect: async () => {
            try {
              const text = await navigator.clipboard.readText();
              replaceEditableContextMenuSelection(target, text);
              toast.success("已粘贴。");
            } catch {
              toast.error("无法读取剪贴板内容。");
            }
          },
        },
        { type: "divider" },
        {
          key: "select-all",
          label: "全选",
          icon: <ListChecks size={16} aria-hidden="true" />,
          onSelect: () => selectAllEditableContextMenuTarget(target),
        },
      ];
    },
    [copyText, toast],
  );

  const resolveEntries = useCallback(
    (eventTarget: EventTarget | null): ContextMenuEntry[] => {
      const targetEntries = findRegisteredTargetEntries(targetRegistry.current, eventTarget);
      if (targetEntries) {
        return targetEntries;
      }

      const editableTarget = captureEditableContextMenuTarget(eventTarget);
      if (editableTarget) {
        return editableEntries(editableTarget);
      }

      const selectedText = window.getSelection()?.toString() ?? "";
      if (!selectedText) {
        return [];
      }

      return [
        {
          key: "copy-selection",
          label: "复制",
          icon: <Copy size={16} aria-hidden="true" />,
          disabled: !navigator.clipboard?.writeText,
          onSelect: async () => {
            await copyText(selectedText);
          },
        },
      ];
    },
    [copyText, editableEntries],
  );

  const openMenu = useCallback(
    (eventTarget: EventTarget | null, clientX: number, clientY: number) => {
      const entries = resolveEntries(eventTarget);
      if (entries.length === 0) {
        setMenuState(null);
        return;
      }

      const position = resolveMenuPosition(eventTarget, clientX, clientY);
      setMenuState({ entries, x: position.x, y: position.y });
    },
    [resolveEntries],
  );

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      openMenu(event.target, event.clientX, event.clientY);
    };

    const handleKeyboardContextMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMenuOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }

      if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) {
        return;
      }

      event.preventDefault();
      openMenu(event.target, 0, 0);
    };

    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("keydown", handleKeyboardContextMenu, true);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("keydown", handleKeyboardContextMenu, true);
    };
  }, [closeMenu, isMenuOpen, openMenu]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isEventInsideContextMenu(event)) {
        return;
      }

      closeMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeMenu, isMenuOpen]);

  const menu = useMemo<MenuProps>(() => {
    const entries = menuState?.entries ?? [];

    return {
      items: entries.map((entry, index) => {
        if (isDivider(entry)) {
          return { type: "divider", key: entry.key ?? `divider-${index}` };
        }

        return {
          key: entry.key,
          label: entry.label,
          icon: entry.icon,
          danger: entry.danger,
          disabled: entry.disabled,
        };
      }),
      onClick: ({ key }) => {
        const entry = entries.find(
          (candidate): candidate is ContextMenuAction =>
            !isDivider(candidate) && candidate.key === key,
        );
        closeMenu();
        try {
          void Promise.resolve(entry?.onSelect?.()).catch(() =>
            toast.error("操作失败，请重试。"),
          );
        } catch {
          toast.error("操作失败，请重试。");
        }
      },
    };
  }, [closeMenu, menuState, toast]);

  const registry = useMemo<ContextMenuRegistry>(
    () => ({ registerTarget }),
    [registerTarget],
  );
  const anchorStyle = menuState
    ? { left: `${menuState.x}px`, top: `${menuState.y}px` }
    : undefined;

  return (
    <ContextMenuRegistryContext.Provider value={registry}>
      {children}
      <Dropdown
        autoFocus
        autoAdjustOverflow
        classNames={{ root: "studio-context-menu" }}
        destroyOnHidden
        menu={menu}
        open={Boolean(menuState)}
        placement="bottomLeft"
        trigger={[]}
        onOpenChange={(open) => {
          if (!open) {
            closeMenu();
          }
        }}
      >
        <span
          aria-hidden="true"
          className="studio-context-menu-anchor"
          style={anchorStyle}
        />
      </Dropdown>
    </ContextMenuRegistryContext.Provider>
  );
}

export function useContextMenuRegistry(): ContextMenuRegistry {
  const registry = useContext(ContextMenuRegistryContext);
  if (!registry) {
    throw new Error("useContextMenuRegistry must be used inside AppContextMenu.");
  }

  return registry;
}

function findRegisteredTargetEntries(
  registry: WeakMap<HTMLElement, ContextMenuEntry[]>,
  eventTarget: EventTarget | null,
): ContextMenuEntry[] | null {
  let element = eventTargetToElement(eventTarget);

  while (element) {
    const entries = registry.get(element);
    if (entries) {
      return entries;
    }
    element = element.parentElement;
  }

  return null;
}

function eventTargetToElement(target: EventTarget | null): HTMLElement | null {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Element) {
    return target.parentElement;
  }

  return target instanceof Node ? target.parentElement : null;
}

function isEventInsideContextMenu(event: Event): boolean {
  return event.composedPath().some(
    (eventTarget) =>
      eventTarget instanceof Element &&
      eventTarget.classList.contains("studio-context-menu"),
  );
}

function resolveMenuPosition(
  eventTarget: EventTarget | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (clientX !== 0 || clientY !== 0) {
    return { x: clientX, y: clientY };
  }

  const element = eventTargetToElement(eventTarget);
  if (!element) {
    return { x: 16, y: 16 };
  }

  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(8, rect.left + Math.min(24, rect.width / 2)),
    y: Math.max(8, rect.top + Math.min(24, rect.height / 2)),
  };
}

function isDivider(entry: ContextMenuEntry): entry is ContextMenuDivider {
  return "type" in entry && entry.type === "divider";
}
