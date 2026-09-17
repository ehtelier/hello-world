"use client";

import { useTransition } from "react";
import { deleteEvent } from "./actions";

export function DeleteEventButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Delete "${eventName}"? This cannot be undone.`)) {
          startTransition(() => {
            deleteEvent(eventId);
          });
        }
      }}
      style={{
        background: "none",
        border: "1px solid rgba(229, 72, 77, 0.5)",
        borderRadius: "6px",
        padding: "6px 12px",
        color: "#e5484d",
        cursor: "pointer",
        fontSize: "0.8rem",
        whiteSpace: "nowrap",
      }}
    >
      Delete
    </button>
  );
}
