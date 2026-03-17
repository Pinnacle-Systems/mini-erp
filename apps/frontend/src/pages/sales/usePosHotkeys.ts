import { useEffect } from "react";

type UsePosHotkeysOptions = {
  enabled: boolean;
  onSaveDraft: () => void;
  onOpenPayment: () => void;
  onClearSearch: () => void;
  onRemoveActiveLine: () => void;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function usePosHotkeys({
  enabled,
  onSaveDraft,
  onOpenPayment,
  onClearSearch,
  onRemoveActiveLine,
}: UsePosHotkeysOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const hasPrimaryModifier = event.ctrlKey || event.metaKey;
      const isEditable = isEditableTarget(event.target);

      if (hasPrimaryModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSaveDraft();
        return;
      }

      if (hasPrimaryModifier && event.key === "Enter") {
        event.preventDefault();
        onOpenPayment();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClearSearch();
        return;
      }

      if (
        hasPrimaryModifier &&
        (event.key === "Backspace" || event.key === "Delete") &&
        !isEditable
      ) {
        event.preventDefault();
        onRemoveActiveLine();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onClearSearch, onOpenPayment, onRemoveActiveLine, onSaveDraft]);
}
