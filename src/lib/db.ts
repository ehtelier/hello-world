import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    client = neon(url);
  }
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values);
}

export type EventRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  disabled: boolean;
  password_hash: string | null;
  expires_at: string | null;
};
