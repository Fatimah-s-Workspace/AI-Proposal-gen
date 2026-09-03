"use client";

import { Check, Circle } from "lucide-react";
import { checkPasswordRules } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

/**
 * The password rules, ticking off as they are met.
 *
 * Shown up front rather than as errors after submitting. Composition rules
 * are guesswork until you know what they are, and being told "password needs
 * a symbol" only once you have already pressed the button - having lost the
 * rest of the form to a failed submit - is how people end up choosing
 * "Password1!" out of irritation.
 *
 * The list is rendered from the same PASSWORD_RULES the server validates
 * with, so the two cannot disagree about what is required.
 */
export function PasswordRequirements({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const rules = checkPasswordRules(value);

  return (
    <ul
      className={cn("mt-2 grid gap-1 sm:grid-cols-2", className)}
      // Announced as a group when it changes rather than one item at a time,
      // which would make a screen reader chatter on every keystroke.
      aria-live="polite"
      aria-label="Password requirements"
    >
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors",
            rule.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {/* An icon as well as a colour, so "met" is not carried by hue
              alone for anyone who cannot distinguish it. */}
          {rule.met ? (
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{rule.label}</span>
          <span className="sr-only">{rule.met ? " - met" : " - not yet met"}</span>
        </li>
      ))}
    </ul>
  );
}
