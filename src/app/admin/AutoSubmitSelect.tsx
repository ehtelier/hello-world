"use client";

export function AutoSubmitSelect({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly string[];
  defaultValue: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      style={{
        padding: "6px 8px",
        borderRadius: "6px",
        border: "1px solid rgba(128, 128, 128, 0.4)",
        background: "transparent",
        color: "inherit",
        fontSize: "0.8rem",
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
