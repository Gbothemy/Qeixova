import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { initializeFlutterwavePayment } from "@/lib/flutterwave";
import { ensureBusinessPremiumSchema, PREMIUM_MONTHLY_PRICE_NAIRA } from "@/lib/premium";

export async function GET() {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureBusinessPremiumSchema();
    const rows = await sql`SELECT ends_at, is_permanent FROM contributor_premium_subscriptions WHERE business_id = ${session.businessId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) ORDER BY ends_at DESC LIMIT 1`;
    return NextResponse.json({ active: Boolean(rows[0]), permanent: Boolean(rows[0]?.is_permanent), endsAt: rows[0]?.ends_at ?? null, monthlyPrice: PREMIUM_MONTHLY_PRICE_NAIRA });
  } catch (error) {
    console.error("Business Premium status error:", error);
    return NextResponse.json({ error: "Could not load Business Premium status." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureBusinessPremiumSchema();
    const current = await sql`SELECT 1 FROM contributor_premium_subscriptions WHERE business_id = ${session.businessId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) LIMIT 1`;
    if (current.length) return NextResponse.json({ error: "Business Premium is already active." }, { status: 409 });
    const reference = `QXBP-${session.businessId}-${randomUUID()}`;
    await sql`INSERT INTO contributor_premium_subscriptions (business_id, reference, amount_naira) VALUES (${session.businessId}, ${reference}, ${PREMIUM_MONTHLY_PRICE_NAIRA})`;
    try {
      const payment = await initializeFlutterwavePayment({
        email: session.email,
        amountNaira: PREMIUM_MONTHLY_PRICE_NAIRA,
        reference,
        callbackUrl: `${request.nextUrl.origin}/api/business/premium/verify?reference=${encodeURIComponent(reference)}`,
        title: "Qeixova Business Premium",
        description: "One month of Qeixova Business Premium.",
        metadata: { businessId: session.businessId, plan: "business_premium_monthly", reference },
      });
      if (!payment.data?.link) throw new Error("Flutterwave did not return a checkout link.");
      return NextResponse.json({ authorizationUrl: payment.data.link, reference });
    } catch (error) {
      await sql`UPDATE contributor_premium_subscriptions SET status = 'failed', updated_at = NOW() WHERE reference = ${reference} AND status = 'pending'`;
      throw error;
    }
  } catch (error) {
    console.error("Business Premium checkout error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Business Premium checkout." }, { status: 502 });
  }
}
