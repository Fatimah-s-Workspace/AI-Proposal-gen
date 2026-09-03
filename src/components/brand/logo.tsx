import { cn } from "@/lib/utils";

type Tone = "theme" | "onDark";

/**
 * The TenderFlow AI mark: a folded page whose lines rise like a bid that is
 * winning.
 *
 * It is drawn rather than shipped as an <img> so it can take its colours from
 * the theme. The default tone uses `primary` for the page and
 * `primary-foreground` for the bars - the token already guaranteed to be
 * legible on primary in both light and dark.
 *
 * `onDark` exists for the marketing panels, which are a fixed dark navy
 * whatever the theme is doing. The themed deep teal all but disappears
 * against slate-950, so those surfaces get the bright teal instead.
 */
export function LogoMark({
  className,
  tone = "theme",
}: {
  className?: string;
  tone?: Tone;
}) {
  const onDark = tone === "onDark";

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-10 shrink-0", className)}
      role="img"
      aria-label="TenderFlow AI"
    >
      <path
        d="M11 5h16l10 10v28a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"
        className={onDark ? "fill-teal-400" : "fill-primary"}
      />
      {/* The turned corner. Black at low opacity rather than its own token, so
          it darkens whatever the page colour happens to be. */}
      <path d="M27 5l10 10h-8a2 2 0 0 1-2-2z" className="fill-black/25" />
      <path
        d="M16 35v-5M23 35v-11M30 35v-17"
        className={onDark ? "stroke-slate-950" : "stroke-primary-foreground"}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark.
 *
 * "AI" is set lighter than "TenderFlow" so the product name reads first and
 * the qualifier second, at a glance and at small sizes.
 */
export function Logo({
  className,
  markClassName,
  showSubtitle = false,
  tone = "theme",
}: {
  className?: string;
  markClassName?: string;
  showSubtitle?: boolean;
  tone?: Tone;
}) {
  const onDark = tone === "onDark";

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} tone={tone} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-semibold tracking-tight">
          TenderFlow{" "}
          <span
            className={cn(
              "font-normal",
              onDark ? "text-white/60" : "text-muted-foreground",
            )}
          >
            AI
          </span>
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "text-xs",
              onDark ? "text-white/60" : "text-muted-foreground",
            )}
          >
            Proposal workspace
          </span>
        )}
      </span>
    </span>
  );
}
