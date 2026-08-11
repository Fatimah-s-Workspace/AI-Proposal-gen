"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

const emptySubscribe = () => () => {};

export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  // False on the server and for the hydrating render, true afterwards. A
  // modal can be open on first paint (the project form opens from ?edit=1),
  // and portalling during hydration makes React's tree disagree with the
  // server HTML - so the portal waits until hydration is done.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Portalled to the body because `position: fixed` resolves against the
  // nearest ancestor with a transform, filter, or backdrop-filter rather than
  // the viewport. Several page headers here are sticky with backdrop-blur, so
  // a modal opened from a button inside one was positioned against that
  // header and hung off the top of the screen.
  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex h-full w-full max-h-full flex-col bg-background shadow-lg sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-lg",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="-mr-2 -mt-2 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
