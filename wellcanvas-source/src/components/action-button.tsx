"use client";

import type { ButtonHTMLAttributes } from "react";

export type ActionButtonState = "idle" | "pending" | "success";

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  className?: string;
  idleLabel: string;
  pendingLabel: string;
  state: ActionButtonState;
  successLabel: string;
  variant?: "accent" | "dark" | "secondary" | "destructive";
};

const variantClasses = {
  accent: "btn-primary-accent",
  dark: "btn-primary-dark",
  secondary: "btn-secondary-outline",
  destructive: "btn-destructive",
};

export function ActionButton({
  className = "",
  disabled,
  idleLabel,
  pendingLabel,
  state,
  successLabel,
  variant = "accent",
  ...props
}: ActionButtonProps) {
  const label =
    state === "pending" ? pendingLabel : state === "success" ? successLabel : idleLabel;

  return (
    <button
      className={`btn min-w-[7rem] px-3 text-sm ${variantClasses[variant]} ${className}`}
      disabled={disabled || state === "pending"}
      type="button"
      {...props}
    >
      {state === "success" && (
        <span className="sr-only">Success: </span>
      )}
      {label}
    </button>
  );
}
