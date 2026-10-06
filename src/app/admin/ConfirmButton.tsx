"use client";

import { useTransition } from "react";

export function ConfirmButton({
  label,
  confirmMessage,
  onConfirm,
  variant = "default",
}: {
  label: string;
  confirmMessage: string;
  onConfirm: () => void | Promise<void>;
  variant?: "default" | "danger";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(confirmMessage)) {
          startTransition(() => {
            onConfirm();
          });
        }
      }}
      style={{
        background: "none",
        border: `1px solid ${variant === "danger" ? "rgba(229, 72, 77, 0.5)" : "rgba(128, 128, 128, 0.4)"}`,
        borderRadius: "6px",
        padding: "6px 10px",
        color: variant === "danger" ? "#e5484d" : "inherit",
        cursor: "pointer",
        fontSize: "0.75rem",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
