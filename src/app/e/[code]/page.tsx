import { sql, type EventRow } from "@/lib/db";

export default async function EventGallery({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = code.trim().toUpperCase();

  const [event] = (await sql`
    SELECT * FROM events WHERE code = ${normalizedCode} LIMIT 1
  `) as EventRow[];

  if (!event || event.disabled) {
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
          NO ENTRY
        </p>
        <p style={{ maxWidth: "22rem", opacity: 0.75 }}>
          That code does not open any door.
        </p>
      </main>
    );
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
        gap: "16px",
      }}
    >
      <p style={{ letterSpacing: "0.3em", fontSize: "0.7rem", opacity: 0.5 }}>
        YOU ARE IN
      </p>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{event.name}</h1>
      <p style={{ maxWidth: "24rem", opacity: 0.75 }}>
        The gallery for this outing is not open yet. Come back once the club
        has finished building it.
      </p>
    </main>
  );
}
