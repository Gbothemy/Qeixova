import { sendNotification, setVapidDetails } from "web-push";
import { sql } from "@/lib/db";

export type ContributorPushPayload = { title: string; body: string; url?: string; tag?: string; kind?: string };
export type ContributorPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || "";
}

export function isWebPushConfigured() {
  return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export async function ensureContributorPushSubscriptionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS contributor_push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS contributor_push_subscriptions_user_idx ON contributor_push_subscriptions(user_id)`;
}

export async function saveContributorPushSubscription(userId: number, subscription: ContributorPushSubscription) {
  await ensureContributorPushSubscriptionsTable();
  await sql`
    INSERT INTO contributor_push_subscriptions (user_id, endpoint, subscription)
    VALUES (${userId}, ${subscription.endpoint}, ${JSON.stringify(subscription)}::jsonb)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, subscription = EXCLUDED.subscription, updated_at = NOW()
  `;
}

export async function removeContributorPushSubscription(userId: number, endpoint: string) {
  await ensureContributorPushSubscriptionsTable();
  await sql`DELETE FROM contributor_push_subscriptions WHERE user_id = ${userId} AND endpoint = ${endpoint}`;
}

export async function sendContributorPush(userId: number, payload: ContributorPushPayload) {
  if (!isWebPushConfigured()) return;
  try {
    await ensureContributorPushSubscriptionsTable();
    const rows = await sql`SELECT endpoint, subscription FROM contributor_push_subscriptions WHERE user_id = ${userId}`;
    if (!rows.length) return;
    setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:support@qeixova.com", getVapidPublicKey(), process.env.VAPID_PRIVATE_KEY!.trim());
    await Promise.allSettled(rows.map(async (row) => {
      try {
        await sendNotification(row.subscription as ContributorPushSubscription, JSON.stringify(payload), { TTL: 60, urgency: "high" });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) await removeContributorPushSubscription(userId, String(row.endpoint));
        else console.error("Contributor push delivery failed:", error);
      }
    }));
  } catch (error) {
    console.error("Contributor push delivery failed:", error);
  }
}
