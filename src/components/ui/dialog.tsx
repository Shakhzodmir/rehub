import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared accessible-modal behaviour: scroll lock, Escape to close, focus trap,
 * and focus restore to the trigger on close.
 */
function useModalBehavior(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLElement>
) {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const panel = panelRef.current;
    const initial = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (initial && initial.length ? initial[0] : panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null
        );
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(open, onClose, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg animate-fade-in rounded-xl border border-border bg-card p-6 shadow-xl outline-none",
          className
        )}
      >
        {(title || description) && (
          <div className="mb-4 pr-8">
            {title && <h2 className="font-heading text-lg font-semibold leading-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
}

/** A Dialog that slides in from a screen edge — used for the mobile nav drawer. */
export function Sheet({ open, onClose, side = "left", ariaLabel, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(open, onClose, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 w-72 max-w-[85vw] animate-fade-in shadow-xl outline-none",
          side === "left" ? "left-0" : "right-0",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
