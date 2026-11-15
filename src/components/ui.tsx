"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${base} bg-pine text-snow shadow-sm hover:bg-pine-deep`,
  red: `${base} bg-cranberry text-snow shadow-sm hover:bg-berry-deep`,
  ghost: `${base} border-2 border-parchment bg-snow text-ink hover:border-fir`,
  quiet: `${base} px-3 text-ink-soft underline-offset-4 hover:text-ink hover:underline`,
};

export const inputStyles =
  "w-full rounded-lg border-2 border-parchment bg-snow px-3 py-2.5 text-ink placeholder:text-ink-soft/60 focus:border-fir focus:outline-none";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...rest} disabled={pending || disabled} className={`${buttonStyles[variant]} ${className}`}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border-l-4 border-cranberry bg-cranberry/10 px-3 py-2 text-berry-deep">
      {message}
    </p>
  );
}
