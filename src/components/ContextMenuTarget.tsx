import { useLayoutEffect, useRef, type ReactNode } from "react";

import {
  useContextMenuRegistry,
  type ContextMenuEntry,
} from "./AppContextMenu";

interface ContextMenuTargetProps {
  entries: ContextMenuEntry[];
  children: ReactNode;
  className?: string;
}

export default function ContextMenuTarget({
  entries,
  children,
  className,
}: ContextMenuTargetProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const { registerTarget } = useContextMenuRegistry();

  useLayoutEffect(() => {
    const element = elementRef.current;
    return element ? registerTarget(element, entries) : undefined;
  }, [entries, registerTarget]);

  return (
    <div ref={elementRef} className={className ?? "studio-context-menu-target"}>
      {children}
    </div>
  );
}
