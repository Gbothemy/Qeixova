import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyFlutterwavePayment } from "@/lib/flutterwave";
import { ensurePremiumSubscriptionTable, PREMIUM_MONTHLY_PRICE_NAIRA } from "@/lib/premium";

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference") || req.nextUrl.searchParams.get("tx_ref");
  const destination = new URL("/premium", req.nextUrl.origin);
  if (!reference) {
    destination.searchParams.set("payment", "missing_reference");
    return NextResponse.redirect(destination);
  }

  try {
    await ensurePremiumSubscriptionTable();
    const subscription = await sql`
      SELECT user_id, amount_naira, status FROM contributor_premium_subscriptions
      WHERE reference = ${reference} LIMIT 1
    `;
    if (!subscription[0]) {
      destination.searchParams.set("payment", "failed");
      return NextResponse.redirect(destination);
    }
    if (subscription[0].status === "active") {
      destination.searchParams.set("payment", "success");
      return NextResponse.redirect(destination);
    }

    const verification = await verifyFlutterwavePayment(reference);
    const charge = verification.data;
    const amountPaid = Number(charge?.charged_amount ?? charge?.amount ?? 0);
    const amountExpected = Number(subscription[0].amount_naira);
    const valid = charge?.tx_ref === reference
      && charge?.status === "successful"
      && charge?.currency === "NGN"
      && amountExpected === PREMIUM_MONTHLY_PRICE_NAIRA
      && amountPaid >= amountExpected;

    if (!valid) {
      destination.searchParams.set("payment", charge?.status === "pending" ? "pending" : "failed");
      return NextResponse.redirect(destination);
    }

    const activated = await sql`
      UPDATE contributor_premium_subscriptions
      SET status = 'active', starts_at = NOW(), ends_at = NOW() + INTERVAL '1 month',
          provider_transaction_id = ${String(charge?.id ?? "")}, updated_at = NOW()
      WHERE reference = ${reference} AND status = 'pending'
      RETURNING id
    `;
    if (!activated[0]) {
      const alreadyActive = await sql`SELECT id FROM contributor_premium_subscriptions WHERE reference = ${reference} AND status = 'active' LIMIT 1`;
      destination.searchParams.set("payment", alreadyActive[0] ? "success" : "pending");
      return NextResponse.redirect(destination);
    }
    destination.searchParams.set("payment", "success");
  } catch (error) {
    console.error("Premium payment verification error:", error);
    destination.searchParams.set("payment", "failed");
  }
  return NextResponse.redirect(destination);
}
