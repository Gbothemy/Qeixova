import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { ensureBusinessWalletTables, makeFundingReference } from "@/lib/businessWallet";
import { initializeFlutterwavePayment, qltToFlutterwaveNaira } from "@/lib/flutterwave";
import { expireElapsedMissions } from "@/lib/missionExpiry";

export async function GET() {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBusinessWalletTables();
  await expireElapsedMissions();

  const [businessRows, transactions, reservedRows, spentRows] = await Promise.all([
    sql`SELECT balance FROM businesses WHERE id = ${session.businessId}`,
    sql`
      SELECT id, type, amount, label, status, provider, reference, metadata, created_at
      FROM business_transactions
      WHERE business_id = ${session.businessId}
      ORDER BY created_at DESC
      LIMIT 40
    `,
    sql`
      SELECT COALESCE(SUM(GREATEST(total_budget - budget_used, 0)), 0)::int AS reserved
      FROM tasks
      WHERE business_id = ${session.businessId}
        AND COALESCE(task_status, '') <> 'deleted'
        AND COALESCE(task_status, '') <> 'expired'
        AND total_budget > 0
    `,
    sql`
      SELECT COALESCE(SUM(budget_used), 0)::int AS spent
      FROM tasks
      WHERE business_id = ${session.businessId}
        AND COALESCE(task_status, '') <> 'deleted'
    `,
  ]);

  return NextResponse.json({
    balance: businessRows[0]?.balance ?? 0,
    reserved: reservedRows[0]?.reserved ?? 0,
    spent: spentRows[0]?.spent ?? 0,
    transactions,
  });
}

export async function POST(req: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBusinessWalletTables();

  const body = await req.json().catch(() => ({}));
  const amount = Math.round(Number(body.amount));

  if (!Number.isFinite(amount) || amount < 1000) {
    return NextResponse.json({ error: "Minimum funding amount is 1,000 QLT." }, { status: 400 });
  }

  const reference = makeFundingReference(session.businessId);
  const label = "Business wallet funding - Flutterwave";
  const callbackUrl = `${req.nextUrl.origin}/api/flutterwave/verify?reference=${encodeURIComponent(reference)}`;

  await sql`
    INSERT INTO business_transactions (business_id, type, amount, label, status, provider, reference, metadata)
    VALUES (
      ${session.businessId}, 'credit', ${amount}, ${label}, 'pending',
      'flutterwave', ${reference},
      ${JSON.stringify({
        flutterwaveAmountNaira: qltToFlutterwaveNaira(amount),
        callbackUrl,
      })}
    )
  `;

  try {
    const payment = await initializeFlutterwavePayment({
      email: session.email,
      amountQlt: amount,
      reference,
      callbackUrl,
      metadata: {
        businessId: session.businessId,
        businessName: session.name,
        amountQlt: amount,
        reference,
      },
    });

    await sql`
      UPDATE business_transactions
      SET metadata = metadata || ${JSON.stringify({
        flutterwaveReference: reference,
        flutterwaveCheckoutSessionId: payment.data?.id,
        flutterwaveCheckoutUrl: payment.data?.link,
        checkoutUrlCreated: Boolean(payment.data?.link),
      })}::jsonb
      WHERE reference = ${reference}
    `;

    if (!payment.data?.link) {
      return NextResponse.json({ error: "Flutterwave created a checkout session but did not return a payment URL. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      reference,
      authorizationUrl: payment.data?.link,
      message: "Flutterwave checkout created. Complete payment to fund your wallet.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flutterwave initialization failed";

    await sql`
      UPDATE business_transactions
      SET status = 'failed',
          metadata = metadata || ${JSON.stringify({
            error: message,
          })}::jsonb
      WHERE reference = ${reference}
    `;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
