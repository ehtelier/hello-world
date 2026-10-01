"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { checkCode } from "./actions";

const functionalSansStack = "var(--font-functional-sans), Arial, Helvetica, sans-serif";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [notRecognized, setNotRecognized] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setNotRecognized(false);
    startTransition(async () => {
      const result = await checkCode(trimmed);
      if (!result.valid) {
        setNotRecognized(true);
        return;
      }
      // A key, not a password: a brief, quiet acknowledgment (no spinner,
      // no modal) before the page transitions, only for a personal code.
      if (result.participantName) {
        setWelcomeName(result.participantName);
        await wait(700);
      }
      router.push(`/e/${encodeURIComponent(trimmed)}`);
    });
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "grid",
        gridTemplateRows: "15fr 47fr 38fr",
        justifyItems: "center",
        padding: "0 24px",
        textAlign: "center",
        fontFamily: functionalSansStack,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", paddingTop: "40px" }}>
        <p style={{ letterSpacing: "0.45em", fontSize: "0.85rem", opacity: 0.6 }}>PARIS PHOTO CLUB</p>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <p style={{ letterSpacing: "0.3em", fontSize: "1.1rem", opacity: 0.85 }}>
          {welcomeName ? `WELCOME, ${welcomeName.toUpperCase()}` : "PRIVATE ACCESS"}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", paddingBottom: "56px" }}>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
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
            ENTER →
          </button>

          {notRecognized && (
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.1em", opacity: 0.5 }}>
              THAT CODE WASN’T RECOGNIZED.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
