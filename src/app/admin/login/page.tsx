import { login } from "../actions";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Admin</h1>
      <form
        action={login}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          maxWidth: "20rem",
        }}
      >
        <input
          type="password"
          name="password"
          placeholder="PASSWORD"
          autoFocus
          style={{
            width: "100%",
            textAlign: "center",
            letterSpacing: "0.2em",
            fontSize: "1rem",
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
            cursor: "pointer",
          }}
        >
          Log in
        </button>
        {error && (
          <p style={{ color: "#e5484d", fontSize: "0.85rem" }}>
            Incorrect password.
          </p>
        )}
      </form>
    </main>
  );
}
