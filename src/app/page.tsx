"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { checkCode } from "./actions";

const functionalSansStack = "var(--font-functional-sans), Arial, Helvetica, sans-serif";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [notRecognized, setNotRecognized] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setNotRecognized(false);
    startTransition(async () => {
      const valid = await checkCode(trimmed);
      if (valid) {
        router.push(`/e/${encodeURIComponent(trimmed)}`);
      } else {
        setNotRecognized(true);
      }
    });
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
        gap: "28px",
        fontFamily: functionalSansStack,
      }}
    >
      <p style={{ letterSpacing: "0.45em", fontSize: "1rem", opacity: 0.85 }}>PARIS PHOTO CLUB</p>
      <p style={{ letterSpacing: "0.2em", fontSize: "0.75rem", opacity: 0.5 }}>SHOOT → DISCOVER → HANG</p>
      <p style={{ fontSize: "0.85rem", letterSpacing: "0.1em", opacity: 0.6, lineHeight: 1.8 }}>
        PRIVATE EXPERIENCES.
        <br />
        SHARED PERSPECTIVES.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          marginTop: "12px",
          width: "100%",
          maxWidth: "18rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", width: "100%" }}>
          <label htmlFor="code" style={{ fontSize: "0.65rem", letterSpacing: "0.25em", opacity: 0.45 }}>
            ENTER YOUR CODE
          </label>
          <input
            id="code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setNotRecognized(false);
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: "100%",
              textAlign: "center",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              fontSize: "1rem",
              padding: "8px 4px",
              border: "none",
              borderBottom: "1px solid rgba(128, 128, 128, 0.4)",
              borderRadius: 0,
              background: "transparent",
              color: "inherit",
              fontFamily: "inherit",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "none",
            border: "none",
            padding: "14px 24px",
            color: "inherit",
            fontWeight: 600,
            fontSize: "0.8rem",
            letterSpacing: "0.2em",
            cursor: "pointer",
          }}
        >
          ENTER
        </button>

        {notRecognized && (
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.1em", opacity: 0.5 }}>
            THAT CODE WASN’T RECOGNIZED.
          </p>
        )}
      </form>
    </main>
  );
}
