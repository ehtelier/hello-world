export default async function EventGallery({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

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
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        {code.toUpperCase()}
      </h1>
      <p style={{ maxWidth: "24rem", opacity: 0.75 }}>
        This gallery is not open yet. Come back once the club has finished
        building it.
      </p>
    </main>
  );
}
