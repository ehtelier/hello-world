"use client";

import { useState, useTransition } from "react";

// A quiet typographic equivalent of a confirm() dialog, specifically for
// Decline: unlike Accept (which should feel effortless, no confirmation),
// Decline changes the participant's event status and is worth guarding
// against an accidental tap.
export function DeclineControl({ onDecline }: { onDecline: () => void | Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", opacity: 0.5, marginBottom: "6px" }}>
          DECLINE THIS INVITATION?
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => onDecline())}
          style={{
            background: "none",
            border: "none",
            padding: "12px 20px",
            color: "inherit",
            opacity: 0.55,
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            cursor: "pointer",
          }}
        >
          YES, DECLINE
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{
            background: "none",
            border: "none",
            padding: "12px 20px",
            color: "inherit",
            opacity: 0.35,
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            cursor: "pointer",
          }}
        >
          GO BACK
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      style={{
        background: "none",
        border: "none",
        padding: "16px 24px",
        color: "inherit",
        opacity: 0.35,
        fontSize: "0.7rem",
        letterSpacing: "0.15em",
        cursor: "pointer",
      }}
    >
      DECLINE
    </button>
  );
}
