import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../atoms/Button";

export type FloatingActionMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

type FloatingActionMenuProps = {
  anchorRect: DOMRect;
  items: FloatingActionMenuItem[];
  onClose: () => void;
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

const VIEWPORT_PADDING = 8;
const MENU_GAP = 8;

const getMenuPosition = (
  anchorRect: DOMRect,
  menuRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
): MenuPosition => {
  const availableBelow = viewportHeight - anchorRect.bottom - VIEWPORT_PADDING;
  const availableAbove = anchorRect.top - VIEWPORT_PADDING;
  const preferAbove =
    availableBelow < menuRect.height + MENU_GAP && availableAbove > availableBelow;

  const unclampedTop = preferAbove
    ? anchorRect.top - menuRect.height - MENU_GAP
    : anchorRect.bottom + MENU_GAP;
  const top = Math.min(
    Math.max(VIEWPORT_PADDING, unclampedTop),
    Math.max(VIEWPORT_PADDING, viewportHeight - menuRect.height - VIEWPORT_PADDING),
  );

  const unclampedLeft = anchorRect.right - menuRect.width;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, unclampedLeft),
    Math.max(VIEWPORT_PADDING, viewportWidth - menuRect.width - VIEWPORT_PADDING),
  );

  return {
    top,
    left,
    maxHeight: Math.max(120, viewportHeight - VIEWPORT_PADDING * 2),
  };
};

export function FloatingActionMenu({
  anchorRect,
  items,
  onClose,
}: FloatingActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition>({
    top: anchorRect.bottom + MENU_GAP,
    left: Math.max(VIEWPORT_PADDING, anchorRect.right - 176),
    maxHeight: Math.max(120, window.innerHeight - VIEWPORT_PADDING * 2),
  });

  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    if (!menuElement) {
      return;
    }

    const menuRect = menuElement.getBoundingClientRect();
    setPosition(
      getMenuPosition(anchorRect, menuRect, window.innerWidth, window.innerHeight),
    );
  }, [anchorRect, items]);

  useEffect(() => {
    const handleViewportChange = () => {
      onClose();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label="Close actions"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className="absolute min-w-[10rem] overflow-y-auto rounded-lg border border-border/80 bg-white p-1 text-left shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
        style={{
          top: position.top,
          left: position.left,
          maxHeight: position.maxHeight,
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="grid gap-1">
          {items.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 w-full justify-start gap-1.5 px-2.5 text-[11px] ${
                item.tone === "danger"
                  ? "text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                  : "text-[#15314e]"
              }`}
              disabled={item.disabled}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.disabled && item.key !== "delete" ? "Working..." : item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
