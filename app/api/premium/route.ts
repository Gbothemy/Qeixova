import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { initializeFlutterwavePayment } from "@/lib/flutterwave";
import { ensurePremiumSubscriptionTable, PREMIUM_MONTHLY_PRICE_NAIRA } from "@/lib/premium";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensurePremiumSubscriptionTable();
    const rows = await sql`
      SELECT ends_at, is_permanent FROM contributor_premium_subscriptions
      WHERE user_id = ${session.userId} AND status = 'active'
        AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW())
      ORDER BY ends_at DESC LIMIT 1
    `;
    return NextResponse.json({ active: Boolean(rows[0]), permanent: Boolean(rows[0]?.is_permanent), endsAt: rows[0]?.ends_at ?? null, monthlyPrice: PREMIUM_MONTHLY_PRICE_NAIRA });
  } catch (error) {
    console.error("Premium status error:", error);
    return NextResponse.json({ error: "Could not load Premium status." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensurePremiumSubscriptionTable();
    const current = await sql`
      SELECT ends_at FROM contributor_premium_subscriptions
      WHERE user_id = ${session.userId} AND status = 'active'
        AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW())
      ORDER BY ends_at DESC LIMIT 1
    `;
    if (current[0]) return NextResponse.json({ error: "Your Premium subscription is already active.", endsAt: current[0].ends_at }, { status: 409 });

    const reference = `QXPREM-${session.userId}-${randomUUID()}`;
    await sql`
      INSERT INTO contributor_premium_subscriptions (user_id, reference, amount_naira)
      VALUES (${session.userId}, ${reference}, ${PREMIUM_MONTHLY_PRICE_NAIRA})
    `;
    const callbackUrl = `${req.nextUrl.origin}/api/premium/verify?reference=${encodeURIComponent(reference)}`;
    try {
      const payment = await initializeFlutterwavePayment({
        email: session.email,
        amountNaira: PREMIUM_MONTHLY_PRICE_NAIRA,
        reference,
        callbackUrl,
        title: "Qeixova Premium",
        description: "One month of Qeixova Premium membership.",
        metadata: { userId: session.userId, plan: "premium_monthly", reference },
      });
      if (!payment.data?.link) throw new Error("Flutterwave did not return a checkout link.");
      return NextResponse.json({ authorizationUrl: payment.data.link, reference });
    } catch (error) {
      await sql`UPDATE contributor_premium_subscriptions SET status = 'failed', updated_at = NOW() WHERE reference = ${reference} AND status = 'pending'`;
      throw error;
    }
  } catch (error) {
    console.error("Premium checkout error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Premium checkout." }, { status: 502 });
  }
}
