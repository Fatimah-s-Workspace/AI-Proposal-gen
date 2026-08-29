import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "warning" | "info";

const TONES = {
  error: {
    icon: XCircle,
    // role="alert" interrupts a screen reader, which is right for a failure
    // the person has to act on and wrong for a routine confirmation.
    role: "alert" as const,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  success: {
    icon: CheckCircle2,
    role: "status" as const,
    className:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    role: "status" as const,
    className:
      "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  },
  info: {
    icon: Info,
    role: "status" as const,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
};

/**
 * One way of telling the user what happened.
 *
 * The auth screens each hand-rolled their own coloured paragraph, so a
 * failure and a success looked like the same sentence in different colours -
 * and colour alone is not something everyone can read. This pairs every
 * message with an icon and the right ARIA role, so the meaning survives
 * without colour and reaches a screen reader.
 */
export function Feedback({
  tone = "error",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, role, className: toneClassName } = TONES[tone];

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm",
        toneClassName,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        <p className="leading-relaxed [text-wrap:pretty]">{children}</p>
      </div>
    </div>
  );
}
