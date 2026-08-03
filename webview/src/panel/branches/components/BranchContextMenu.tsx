import { useEffect, useRef, useState } from "react";
import type {
  BranchActionId,
  BranchActionMenuItem,
} from "../actions/branchActionTypes";

export interface BranchContextMenuProps {
  x: number;
  y: number;
  name: string;
  items: readonly BranchActionMenuItem[];
  onAction(id: BranchActionId): void;
  onClose(): void;
}

export function BranchContextMenu({
  x,
  y,
  name,
  items,
  onAction,
  onClose,
}: BranchContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const rect = menu.getBoundingClientRect();
      let top = y;
      let left = x;
      if (top + rect.height > window.innerHeight) {
        const above = y - rect.height;
        top =
          above >= 4
            ? above
            : Math.max(4, window.innerHeight - rect.height - 4);
      }
      if (left + rect.width > window.innerWidth) {
        left = Math.max(4, window.innerWidth - rect.width - 4);
      }
      setPosition({ top, left });
    });
    return () => cancelAnimationFrame(frame);
  }, [x, y]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const closeOnBlur = () => onClose();
    const closeOnScroll = (event: Event) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", closeOutside, true);
    document.addEventListener("contextmenu", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", closeOnBlur);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnBlur);
    return () => {
      document.removeEventListener("mousedown", closeOutside, true);
      document.removeEventListener("contextmenu", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", closeOnBlur);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnBlur);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${name}`}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
        background: "var(--vscode-menu-background, #1e1e1e)",
        border: "1px solid var(--vscode-menu-border, #454545)",
        borderRadius: 4,
        padding: "4px 0",
        minWidth: 160,
        maxHeight: "calc(100vh - 8px)",
        overflowY: "auto",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {items.map((item) =>
        item.kind === "separator" ? (
          <div
            key={`separator:${item.id}`}
            style={{
              height: 1,
              background: "var(--vscode-menu-separatorBackground, #454545)",
              margin: "4px 0",
            }}
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={!item.enabled}
            aria-label={item.label}
            aria-disabled={!item.enabled || undefined}
            aria-description={item.disabledReason}
            title={item.disabledReason}
            onClick={item.enabled ? () => onAction(item.id) : undefined}
            style={{
              width: "100%",
              border: 0,
              padding: "6px 16px",
              background: "transparent",
              cursor: item.enabled ? "pointer" : "default",
              opacity: item.enabled ? 1 : 0.5,
              color: "var(--vscode-menu-foreground, #ccc)",
              font: "inherit",
              fontSize: "13px",
              textAlign: "left",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(event) => {
              if (item.enabled) {
                event.currentTarget.style.background =
                  "var(--vscode-list-hoverBackground, #2a2d2e)";
                event.currentTarget.style.color =
                  "var(--vscode-menu-selectionForeground, #fff)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.color =
                "var(--vscode-menu-foreground, #ccc)";
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
