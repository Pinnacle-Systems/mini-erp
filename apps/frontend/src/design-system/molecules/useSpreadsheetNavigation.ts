import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

export const SPREADSHEET_CELL_ATTRIBUTE = "data-spreadsheet-cell";
export const SPREADSHEET_ROW_ATTRIBUTE = "data-spreadsheet-row";
export const SPREADSHEET_FIELD_ATTRIBUTE = "data-spreadsheet-field";

export type SpreadsheetCell<FieldKey extends string> = {
  rowId: string;
  field: FieldKey;
};

export type SpreadsheetAppendMode = "grow-as-needed" | "restricted";

export const DESKTOP_GROW_AS_NEEDED_STARTER_ROWS = 5;
export const MOBILE_GROW_AS_NEEDED_STARTER_ROWS = 1;

type SpreadsheetDirection = "previous" | "next" | "up" | "down";

type SpreadsheetNavigationOptions<FieldKey extends string> = {
  containerRef: RefObject<HTMLElement | null>;
  getRowOrder: () => string[];
  getFieldOrderForRow: (rowId: string) => FieldKey[];
  appendMode?: SpreadsheetAppendMode;
  canAppendFromRow?: (rowId: string) => boolean;
  onRequestAppendRow?: (cell: SpreadsheetCell<FieldKey>) => void;
};

const getSpreadsheetCellId = (rowId: string, field: string) => `${rowId}:${field}`;

export const getSpreadsheetCellDataAttributes = <FieldKey extends string>(
  rowId: string,
  field: FieldKey,
): Record<string, string> => ({
  [SPREADSHEET_CELL_ATTRIBUTE]: getSpreadsheetCellId(rowId, field),
  [SPREADSHEET_ROW_ATTRIBUTE]: rowId,
  [SPREADSHEET_FIELD_ATTRIBUTE]: field,
});

const supportsTextSelection = (element: EventTarget | null): element is HTMLInputElement => {
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  return !["checkbox", "radio", "button", "submit"].includes(element.type);
};

const shouldKeepNativeHorizontalArrow = (
  event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
) => {
  if (!supportsTextSelection(event.currentTarget)) {
    return false;
  }

  const { selectionStart, selectionEnd, value } = event.currentTarget;
  if (selectionStart == null || selectionEnd == null) {
    return false;
  }

  if (event.key === "ArrowLeft") {
    return selectionStart > 0 || selectionEnd > 0;
  }

  if (event.key === "ArrowRight") {
    return selectionStart < value.length || selectionEnd < value.length;
  }

  return false;
};

const isActiveComboboxTarget = (
  event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
) => {
  if (!(event.currentTarget instanceof HTMLInputElement)) {
    return false;
  }

  if (event.currentTarget.getAttribute("role") !== "combobox") {
    return false;
  }

  return (
    event.currentTarget.getAttribute("aria-expanded") === "true" ||
    event.currentTarget.hasAttribute("aria-activedescendant")
  );
};

const isComboboxOptionHighlighted = (
  event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
) =>
  event.currentTarget instanceof HTMLInputElement &&
  event.currentTarget.hasAttribute("aria-activedescendant");

const getComparableField = <FieldKey extends string>(
  currentField: FieldKey,
  currentFields: FieldKey[],
  targetFields: FieldKey[],
) => {
  if (targetFields.includes(currentField)) {
    return currentField;
  }

  const currentIndex = currentFields.indexOf(currentField);
  if (currentIndex === -1) {
    return targetFields[0] ?? null;
  }

  return targetFields[Math.min(currentIndex, targetFields.length - 1)] ?? null;
};

export function useSpreadsheetNavigation<FieldKey extends string>({
  containerRef,
  getRowOrder,
  getFieldOrderForRow,
  appendMode = "restricted",
  canAppendFromRow,
  onRequestAppendRow,
}: SpreadsheetNavigationOptions<FieldKey>) {
  const [activeCell, setActiveCell] = useState<SpreadsheetCell<FieldKey> | null>(null);
  const appendRowRef = useRef(onRequestAppendRow);
  const canAppendFromRowRef = useRef(canAppendFromRow);

  useEffect(() => {
    appendRowRef.current = onRequestAppendRow;
    canAppendFromRowRef.current = canAppendFromRow;
  }, [canAppendFromRow, onRequestAppendRow]);

  const focusCell = (rowId: string, field: FieldKey) => {
    const target = containerRef.current?.querySelector<HTMLElement>(
      `[${SPREADSHEET_CELL_ATTRIBUTE}="${getSpreadsheetCellId(rowId, field)}"]`,
    );
    if (!target) {
      return false;
    }

    target.focus();
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    setActiveCell({ rowId, field });
    return true;
  };

  const handleCellFocus = (rowId: string, field: FieldKey) => {
    setActiveCell({ rowId, field });
  };

  const handleCellEscape = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
  ) => {
    setActiveCell(null);
    event.currentTarget.blur();
  };

  const moveInRowOrder = (
    direction: Extract<SpreadsheetDirection, "previous" | "next">,
    rowId: string,
    field: FieldKey,
  ) => {
    const rowIds = getRowOrder();
    const rowIndex = rowIds.indexOf(rowId);
    const currentFields = getFieldOrderForRow(rowId);
    const fieldIndex = currentFields.indexOf(field);
    if (rowIndex === -1 || fieldIndex === -1) {
      return;
    }

    const step = direction === "next" ? 1 : -1;
    const nextFieldIndex = fieldIndex + step;
    if (nextFieldIndex >= 0 && nextFieldIndex < currentFields.length) {
      focusCell(rowId, currentFields[nextFieldIndex]);
      return;
    }

    let nextRowIndex = rowIndex + step;
    while (nextRowIndex >= 0 && nextRowIndex < rowIds.length) {
      const nextFields = getFieldOrderForRow(rowIds[nextRowIndex]);
      if (nextFields.length > 0) {
        focusCell(
          rowIds[nextRowIndex],
          step > 0 ? nextFields[0] : nextFields[nextFields.length - 1],
        );
        return;
      }
      nextRowIndex += step;
    }

    if (
      appendMode === "grow-as-needed" &&
      direction === "next" &&
      appendRowRef.current &&
      (canAppendFromRowRef.current?.(rowId) ?? true)
    ) {
      appendRowRef.current({ rowId, field });
    }
  };

  const moveInColumnOrder = (
    direction: Extract<SpreadsheetDirection, "up" | "down">,
    rowId: string,
    field: FieldKey,
  ) => {
    const rowIds = getRowOrder();
    const rowIndex = rowIds.indexOf(rowId);
    const currentFields = getFieldOrderForRow(rowId);
    if (rowIndex === -1 || currentFields.length === 0) {
      return;
    }

    const step = direction === "down" ? 1 : -1;
    let nextRowIndex = rowIndex + step;

    while (nextRowIndex >= 0 && nextRowIndex < rowIds.length) {
      const nextFields = getFieldOrderForRow(rowIds[nextRowIndex]);
      if (nextFields.length > 0) {
        const targetField = getComparableField(field, currentFields, nextFields);
        if (targetField) {
          focusCell(rowIds[nextRowIndex], targetField);
        }
        return;
      }
      nextRowIndex += step;
    }
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
    rowId: string,
    field: FieldKey,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (
      isActiveComboboxTarget(event) &&
      ((event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Escape") ||
        (event.key === "Enter" && isComboboxOptionHighlighted(event)))
    ) {
      return;
    }

    if (event.key === "Escape") {
      handleCellEscape(event);
      return;
    }

    if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      shouldKeepNativeHorizontalArrow(event)
    ) {
      return;
    }

    let direction: SpreadsheetDirection | null = null;

    if (event.key === "Tab" || event.key === "Enter") {
      direction = event.shiftKey ? "previous" : "next";
    } else if (event.key === "ArrowLeft") {
      direction = "previous";
    } else if (event.key === "ArrowRight") {
      direction = "next";
    } else if (event.key === "ArrowUp") {
      direction = "up";
    } else if (event.key === "ArrowDown") {
      direction = "down";
    }

    if (!direction) {
      return;
    }

    event.preventDefault();

    if (direction === "previous" || direction === "next") {
      moveInRowOrder(direction, rowId, field);
      return;
    }

    moveInColumnOrder(direction, rowId, field);
  };

  return {
    activeCell,
    focusCell,
    handleCellFocus,
    handleCellKeyDown,
    getCellDataAttributes: getSpreadsheetCellDataAttributes,
  };
}
