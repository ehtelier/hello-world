export default function Home() {
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
        gap: "16px",
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
        members. No account to create, nothing to download. If you were
        given the code, you already belong. Scan it, and step inside.
      </p>
    </main>
  );
}
