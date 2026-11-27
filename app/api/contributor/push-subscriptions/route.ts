import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureContributorPushSubscriptionsTable, getVapidPublicKey, isWebPushConfigured, removeContributorPushSubscription, saveContributorPushSubscription, type ContributorPushSubscription } from "@/lib/webPush";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureContributorPushSubscriptionsTable();
    const rows = await sql`SELECT 1 FROM contributor_push_subscriptions WHERE user_id = ${session.userId} LIMIT 1`;
    return NextResponse.json({ configured: isWebPushConfigured(), publicKey: getVapidPublicKey() || null, subscribed: rows.length > 0 });
  } catch {
    return NextResponse.json({ error: "Push notification settings could not load." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "unsubscribe") {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    if (!endpoint.startsWith("https://")) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    await removeContributorPushSubscription(session.userId, endpoint);
    return NextResponse.json({ ok: true });
  }
  if (!isWebPushConfigured()) return NextResponse.json({ error: "Browser notifications are not configured on the server yet." }, { status: 503 });
  const subscription = body.subscription as ContributorPushSubscription | undefined;
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://") || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  try {
    await saveContributorPushSubscription(session.userId, subscription);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "This device could not be registered for notifications." }, { status: 503 });
  }
}
