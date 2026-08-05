import { sql } from "@/lib/db";
import { ensureBusinessWalletTables } from "@/lib/businessWallet";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { qltToFlutterwaveNaira, verifyFlutterwavePayment } from "@/lib/flutterwave";

type CompletionResult = {
  ok: boolean;
  status: "completed" | "pending" | "failed";
  message: string;
  businessId?: number;
  amount?: number;
};

export async function completeFlutterwaveWalletFunding(reference: string): Promise<CompletionResult> {
  await ensureBusinessWalletTables();

  const transactions = await sql`
    SELECT id, business_id, amount, status, metadata
    FROM business_transactions
    WHERE reference = ${reference}
      AND provider = 'flutterwave'
      AND type = 'credit'
    LIMIT 1
  `;

  const transaction = transactions[0];
  if (!transaction) {
    return { ok: false, status: "failed", message: "Funding reference was not found." };
  }

  if (transaction.status === "completed") {
    return {
      ok: true,
      status: "completed",
      message: "Wallet was already funded.",
      businessId: Number(transaction.business_id),
      amount: Number(transaction.amount),
    };
  }

  const verification = await verifyFlutterwavePayment(reference);
  const data = verification.data;
  const amountQlt = Number(transaction.amount);
  const expectedAmount = qltToFlutterwaveNaira(amountQlt);

  if (!data) {
    await sql`
      UPDATE business_transactions
      SET status = 'pending',
          metadata = metadata || ${JSON.stringify({
            flutterwaveStatus: "not_found",
            expectedAmount,
            checkedAt: new Date().toISOString(),
          })}::jsonb
      WHERE id = ${transaction.id}
        AND status <> 'completed'
    `;

    return {
      ok: false,
      status: "pending",
      message: "Flutterwave payment is not available yet.",
      businessId: Number(transaction.business_id),
      amount: amountQlt,
    };
  }

  const paidAmount = Number(data?.amount ?? 0);
  const status = String(data?.status || "").toLowerCase();
  const paid = ["successful", "succeeded", "completed"].includes(status) && Math.abs(paidAmount - expectedAmount) < 0.01 && data?.currency === "NGN";

  if (!paid) {
    await sql`
      UPDATE business_transactions
      SET status = 'failed',
          metadata = metadata || ${JSON.stringify({
            flutterwaveStatus: data?.status,
            flutterwaveAmount: paidAmount,
            expectedAmount,
            processorResponse: data?.processor_response,
          })}::jsonb
      WHERE id = ${transaction.id}
        AND status <> 'completed'
    `;

    return {
      ok: false,
      status: "failed",
      message: "Flutterwave payment was not successful or amount did not match.",
      businessId: Number(transaction.business_id),
      amount: amountQlt,
    };
  }

  const updated = await sql`
    UPDATE business_transactions
    SET status = 'completed',
        metadata = metadata || ${JSON.stringify({
          flutterwaveId: data?.id,
          flutterwaveStatus: data?.status,
          flutterwaveAmount: paidAmount,
          chargedAmount: data?.charged_amount,
          paidAt: data?.created_at,
          channel: data?.payment_type,
          processorResponse: data?.processor_response,
        })}::jsonb
    WHERE id = ${transaction.id}
      AND status <> 'completed'
    RETURNING business_id, amount
  `;

  if (updated.length === 0) {
    return {
      ok: true,
      status: "completed",
      message: "Wallet was already processed.",
      businessId: Number(transaction.business_id),
      amount: amountQlt,
    };
  }

  const businessId = Number(updated[0].business_id);
  await sql`UPDATE businesses SET balance = balance + ${amountQlt} WHERE id = ${businessId}`;

  await createBusinessNotification({
    businessId,
    type: "wallet",
    tone: "green",
    title: "Wallet funded",
    body: `${amountQlt.toLocaleString()} QLT was added to your business wallet via Flutterwave.`,
    status: "Completed",
    href: "/business/wallet",
    metadata: { amount: amountQlt, method: "flutterwave", reference },
  });

  return {
    ok: true,
    status: "completed",
    message: "Wallet funded successfully.",
    businessId,
    amount: amountQlt,
  };
}

export const completePaystackWalletFunding = completeFlutterwaveWalletFunding;
