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
      <p style={{ letterSpacing: "0.2em", fontSize: "0.75rem", opacity: 0.6 }}>
        SHOOT · DISCOVER · HANG
      </p>
      <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>Paris Photo Club</h1>
      <p style={{ maxWidth: "28rem", opacity: 0.75 }}>
        Private event galleries are coming soon. Scan a QR code from your
        outing to open its gallery — no account, no app.
      </p>
    </main>
  );
}
