import type { EventRow } from "@/lib/db";

// Neon returns `date` columns as JS Date objects at runtime (despite the
// EventRow type saying string), so this has to accept either shape.
function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid rgba(128, 128, 128, 0.4)",
  background: "transparent",
  color: "inherit",
  fontSize: "0.9rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  opacity: 0.6,
  marginBottom: "4px",
  display: "block",
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        style={inputStyle}
      />
    </div>
  );
}

export function EventForm({
  action,
  submitLabel,
  event,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  event?: EventRow;
}) {
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        <Field label="PPC number" name="ppc_number" defaultValue={event?.ppc_number} />
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Event title" name="name" defaultValue={event?.name} required />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        <Field label="Date" name="event_date" type="date" defaultValue={toDateInputValue(event?.event_date)} />
        <Field label="Start time" name="start_time" type="time" defaultValue={event?.start_time} />
        <Field label="End time" name="end_time" type="time" defaultValue={event?.end_time} />
        <Field label="Area / arrondissement" name="area" defaultValue={event?.area} />
        <Field label="Capacity" name="capacity" type="number" defaultValue={event?.capacity} />
      </div>

      <p style={{ fontSize: "0.75rem", letterSpacing: "0.1em", opacity: 0.5, marginTop: "6px" }}>
        ITINERARY (OPTIONAL)
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        <Field label="Shoot location" name="shoot_location" defaultValue={event?.shoot_location} />
        <Field label="Shoot time" name="shoot_time" type="time" defaultValue={event?.shoot_time} />
        <Field label="Discover location" name="discover_location" defaultValue={event?.discover_location} />
        <Field label="Discover time" name="discover_time" type="time" defaultValue={event?.discover_time} />
        <Field label="Hang location" name="hang_location" defaultValue={event?.hang_location} />
        <Field label="Hang time" name="hang_time" type="time" defaultValue={event?.hang_time} />
      </div>

      <p style={{ fontSize: "0.75rem", letterSpacing: "0.1em", opacity: 0.5, marginTop: "6px" }}>
        MEETING POINT (OPTIONAL)
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        <Field label="Meeting point name" name="meeting_point_name" defaultValue={event?.meeting_point_name} />
        <Field label="Address" name="meeting_point_address" defaultValue={event?.meeting_point_address} />
        <Field label="Map link" name="meeting_point_map_link" defaultValue={event?.meeting_point_map_link} />
        <Field label="Estimated steps" name="estimated_steps" defaultValue={event?.estimated_steps} />
      </div>

      <button
        type="submit"
        style={{
          alignSelf: "flex-start",
          padding: "10px 20px",
          borderRadius: "8px",
          border: "none",
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {submitLabel}
      </button>
    </form>
  );
}
