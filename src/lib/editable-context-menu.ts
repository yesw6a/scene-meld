export type EditableContextMenuTarget =
  | {
      type: "text-control";
      element: HTMLInputElement | HTMLTextAreaElement;
      start: number;
      end: number;
      selectedText: string;
      editable: boolean;
    }
  | {
      type: "contenteditable";
      element: HTMLElement;
      range: Range | null;
      selectedText: string;
      editable: boolean;
    };

export function captureEditableContextMenuTarget(
  eventTarget: EventTarget | null,
): EditableContextMenuTarget | null {
  const element = eventTargetToElement(eventTarget);
  const candidate = element?.closest("textarea, input, [contenteditable]");

  if (candidate instanceof HTMLTextAreaElement || candidate instanceof HTMLInputElement) {
    const start = candidate.selectionStart;
    const end = candidate.selectionEnd;

    if (start === null || end === null) {
      return null;
    }

    return {
      type: "text-control",
      element: candidate,
      start,
      end,
      selectedText: candidate.value.slice(start, end),
      editable: !candidate.disabled && !candidate.readOnly,
    };
  }

  if (!(candidate instanceof HTMLElement) || !candidate.isContentEditable) {
    return null;
  }

  const selection = window.getSelection();
  const selectionBelongsToTarget =
    selection?.rangeCount &&
    selection.anchorNode &&
    selection.focusNode &&
    candidate.contains(selection.anchorNode) &&
    candidate.contains(selection.focusNode);
  const range = selectionBelongsToTarget ? selection?.getRangeAt(0).cloneRange() ?? null : null;

  return {
    type: "contenteditable",
    element: candidate,
    range,
    selectedText: range?.toString() ?? "",
    editable: candidate.isContentEditable,
  };
}

export function replaceEditableContextMenuSelection(
  target: EditableContextMenuTarget,
  replacement: string,
): void {
  if (!target.editable) {
    return;
  }

  if (target.type === "text-control") {
    const { element } = target;
    const start = Math.min(target.start, element.value.length);
    const end = Math.min(Math.max(target.end, start), element.value.length);
    const nextValue = `${element.value.slice(0, start)}${replacement}${element.value.slice(end)}`;
    const cursor = start + replacement.length;

    setTextControlValue(element, nextValue);
    element.focus();
    element.setSelectionRange(cursor, cursor);
    dispatchInputEvent(element, replacement ? "insertText" : "deleteContentBackward", replacement);
    return;
  }

  const range = resolveContentEditableRange(target);
  range.deleteContents();

  if (replacement) {
    const textNode = document.createTextNode(replacement);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
  }

  range.collapse(true);
  target.element.focus();
  setSelectionRange(range);
  dispatchInputEvent(
    target.element,
    replacement ? "insertText" : "deleteContentBackward",
    replacement,
  );
}

export function selectAllEditableContextMenuTarget(
  target: EditableContextMenuTarget,
): void {
  if (target.type === "text-control") {
    target.element.focus();
    target.element.select();
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(target.element);
  target.element.focus();
  setSelectionRange(range);
}

function eventTargetToElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }

  return target instanceof Node ? target.parentElement : null;
}

function resolveContentEditableRange(
  target: Extract<EditableContextMenuTarget, { type: "contenteditable" }>,
): Range {
  if (target.range && target.element.contains(target.range.commonAncestorContainer)) {
    return target.range.cloneRange();
  }

  const range = document.createRange();
  range.selectNodeContents(target.element);
  range.collapse(false);
  return range;
}

function setTextControlValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (setter) {
    setter.call(element, value);
    return;
  }

  element.value = value;
}

function dispatchInputEvent(
  element: HTMLElement,
  inputType: string,
  data: string,
): void {
  try {
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, data, inputType }),
    );
  } catch {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function setSelectionRange(range: Range): void {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
