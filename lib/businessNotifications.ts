import { sql } from "@/lib/db";

export type BusinessNotificationTone = "green" | "gold" | "blue" | "purple";
export type BusinessNotificationType =
  | "approved"
  | "participation"
  | "verification"
  | "wallet"
  | "campaign"
  | "system";

export async function ensureBusinessNotificationTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS business_notifications (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Unread',
      tone TEXT NOT NULL DEFAULT 'blue',
      href TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_business_notifications_business_id ON business_notifications(business_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_business_notifications_unread ON business_notifications(business_id, read_at)`;
}

export async function createBusinessNotification(input: {
  businessId: number;
  type: BusinessNotificationType;
  title: string;
  body: string;
  status?: string;
  tone?: BusinessNotificationTone;
  href?: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureBusinessNotificationTables();
  await sql`
    INSERT INTO business_notifications (business_id, type, title, body, status, tone, href, metadata)
    VALUES (
      ${input.businessId},
      ${input.type},
      ${input.title},
      ${input.body},
      ${input.status || "Unread"},
      ${input.tone || "blue"},
      ${input.href || null},
      ${JSON.stringify(input.metadata || {})}::jsonb
    )
  `;
}
