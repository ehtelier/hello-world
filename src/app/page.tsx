"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/e/${encodeURIComponent(trimmed)}`);
  }

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        gap: "20px",
      }}
    >
      <p style={{ letterSpacing: "0.3em", fontSize: "0.7rem", opacity: 0.5 }}>
        BY INVITATION ONLY
      </p>
      <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>Paris Photo Club</h1>
      <p style={{ letterSpacing: "0.2em", fontSize: "0.75rem", opacity: 0.6 }}>
        SHOOT · DISCOVER · HANG
      </p>
      <p style={{ maxWidth: "28rem", opacity: 0.75 }}>
        Every gallery belongs to a single outing and a single circle of
        members. If you were given a code, enter it below. If you scanned a
        code instead, you are already inside.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          marginTop: "12px",
          width: "100%",
          maxWidth: "20rem",
        }}
      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ENTER CODE"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: "100%",
            textAlign: "center",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontSize: "1.1rem",
            padding: "14px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(128, 128, 128, 0.4)",
            background: "transparent",
            color: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "14px 12px",
            borderRadius: "8px",
            border: "none",
            background: "var(--foreground)",
            color: "var(--background)",
            fontSize: "0.95rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Enter
        </button>
      </form>
    </main>
  );
}
