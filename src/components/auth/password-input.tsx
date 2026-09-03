"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field you can read back.
 *
 * This is the alternative to a confirm-password field, and a better one: it
 * solves the same problem - a typo you cannot see, in a value you cannot
 * check - without asking anyone to type a long password twice. It also lets
 * someone paste from a password manager and confirm it arrived intact.
 *
 * The button is deliberately not a focus stop. Someone tabbing from the
 * password field expects to land on the submit button, not on a control they
 * did not ask for; anyone who wants it can still reach it by clicking, and it
 * is announced to screen readers through aria-label.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        // Room for the button, so a long password does not run underneath it.
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
