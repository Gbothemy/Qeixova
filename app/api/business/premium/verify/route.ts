import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyFlutterwavePayment } from "@/lib/flutterwave";
import { ensureBusinessPremiumSchema, PREMIUM_MONTHLY_PRICE_NAIRA } from "@/lib/premium";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") || request.nextUrl.searchParams.get("tx_ref");
  const destination = new URL("/business/creator", request.nextUrl.origin);
  if (!reference) { destination.searchParams.set("premium", "missing-reference"); return NextResponse.redirect(destination); }
  try {
    await ensureBusinessPremiumSchema();
    const rows = await sql`SELECT business_id, amount_naira, status FROM contributor_premium_subscriptions WHERE reference = ${reference} AND business_id IS NOT NULL LIMIT 1`;
    if (!rows[0]) { destination.searchParams.set("premium", "failed"); return NextResponse.redirect(destination); }
    if (rows[0].status === "active") { destination.searchParams.set("premium", "success"); return NextResponse.redirect(destination); }
    const charge = (await verifyFlutterwavePayment(reference)).data;
    const paid = Number(charge?.charged_amount ?? charge?.amount ?? 0);
    const valid = charge?.tx_ref === reference && charge?.status === "successful" && charge?.currency === "NGN" && Number(rows[0].amount_naira) === PREMIUM_MONTHLY_PRICE_NAIRA && paid >= PREMIUM_MONTHLY_PRICE_NAIRA;
    if (!valid) { destination.searchParams.set("premium", charge?.status === "pending" ? "pending" : "failed"); return NextResponse.redirect(destination); }
    const activated = await sql`UPDATE contributor_premium_subscriptions SET status = 'active', starts_at = NOW(), ends_at = NOW() + INTERVAL '1 month', provider_transaction_id = ${String(charge?.id ?? "")}, updated_at = NOW() WHERE reference = ${reference} AND status = 'pending' RETURNING id`;
    if (!activated[0]) {
      const already = await sql`SELECT id FROM contributor_premium_subscriptions WHERE reference = ${reference} AND status = 'active' LIMIT 1`;
      destination.searchParams.set("premium", already[0] ? "success" : "pending");
    } else destination.searchParams.set("premium", "success");
  } catch (error) {
    console.error("Business Premium verification failed:", error);
    destination.searchParams.set("premium", "failed");
  }
  return NextResponse.redirect(destination);
}
