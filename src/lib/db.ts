import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient() {
  if (!client) {
    // The Neon integration was connected with a custom "database" prefix,
    // so Vercel named the injected variable database_DATABASE_URL rather
    // than plain DATABASE_URL. DATABASE_URL is kept as a fallback in case
    // the integration is ever reconnected without a prefix.
    const url = process.env.database_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error("database_DATABASE_URL is not set");
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
