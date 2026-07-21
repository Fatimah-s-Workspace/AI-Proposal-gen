"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TruncatedTextProps = {
  /** Full text to display. The tooltip only appears if this is actually clipped. */
  text: string;
  /** 1 = single-line truncate with ellipsis. 2-6 = multi-line clamp. */
  lines?: 1 | 2 | 3 | 4 | 5 | 6;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  className?: string;
  tooltipClassName?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /** Caps how much text the tooltip shows, for very long source text (e.g. raw document bodies). */
  tooltipMaxChars?: number;
};

const clampClassNames: Record<number, string> = {
  1: "truncate",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

/**
 * Renders truncated/clamped text and only attaches a tooltip with the full
 * text when the content is actually being clipped (measured via
 * scrollWidth/scrollHeight vs the rendered box), so short text never shows a
 * useless tooltip.
 */
export function TruncatedText({
  text,
  lines = 1,
  as = "span",
  className,
  tooltipClassName,
  tooltipSide,
  tooltipMaxChars,
}: TruncatedTextProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const clampClass = clampClassNames[lines] ?? "truncate";

  useEffect(() => {
    if (!node) return;

    function measure() {
      if (!node) return;
      setIsTruncated(
        lines <= 1
          ? node.scrollWidth > node.clientWidth
          : node.scrollHeight > node.clientHeight,
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, text, lines]);

  let content: React.ReactElement;
  if (as === "p") {
    content = (
      <p ref={setNode} className={cn(clampClass, className)}>
        {text}
      </p>
    );
  } else if (as === "div") {
    content = (
      <div ref={setNode} className={cn(clampClass, className)}>
        {text}
      </div>
    );
  } else if (as === "h1") {
    content = (
      <h1 ref={setNode} className={cn(clampClass, className)}>
        {text}
      </h1>
    );
  } else if (as === "h2") {
    content = (
      <h2 ref={setNode} className={cn(clampClass, className)}>
        {text}
      </h2>
    );
  } else if (as === "h3") {
    content = (
      <h3 ref={setNode} className={cn(clampClass, className)}>
        {text}
      </h3>
    );
  } else {
    content = (
      <span ref={setNode} className={cn("block", clampClass, className)}>
        {text}
      </span>
    );
  }

  if (!isTruncated || !text) return content;

  const tooltipText =
    tooltipMaxChars && text.length > tooltipMaxChars
      ? `${text.slice(0, tooltipMaxChars).trim()}…`
      : text;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side={tooltipSide}
          className={cn("max-w-xs whitespace-pre-wrap break-words", tooltipClassName)}
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
