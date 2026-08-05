import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { sendWithdrawalRequestedEmail } from "@/lib/email";
import { canWithdraw } from "@/lib/missionEngine";
import { createContributorNotification } from "@/lib/contributorNotifications";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, bank, bankAccountId } = await req.json();
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt < 100000) {
    return NextResponse.json({ error: "Minimum withdrawal is 100,000 QLT (N10,000)" }, { status: 400 });
  }
  if (!bank && !bankAccountId) {
    return NextResponse.json({ error: "Bank account required" }, { status: 400 });
  }

  // Check withdrawal eligibility (Bronze level required)
  const { allowed, totalEarned, needed } = await canWithdraw(session.userId);
  if (!allowed) {
    return NextResponse.json({
      error: `Withdrawals unlock at Bronze level. You need ${needed.toLocaleString()} more QLT lifetime earnings. Currently at ${totalEarned.toLocaleString()} QLT.`,
      needed,
      totalEarned,
    }, { status: 403 });
  }

  const accountId = Number(bankAccountId ?? bank);
  const bankRows = Number.isFinite(accountId) && accountId > 0
    ? await sql`
        SELECT bank_name, account_number, account_name
        FROM bank_accounts
        WHERE user_id = ${session.userId} AND id = ${accountId}
      `
    : [];
  const rawAccountNumber = !bankRows.length && typeof bank === "string"
    ? bank.split(/[—-]/)[1]?.trim().replace(/\s/g, "") ?? ""
    : "";
  const fallbackBankRows = rawAccountNumber
    ? await sql`
        SELECT bank_name, account_number, account_name
        FROM bank_accounts
        WHERE user_id = ${session.userId} AND account_number = ${rawAccountNumber}
      `
    : [];
  const resolvedBankRows = bankRows.length ? bankRows : fallbackBankRows;

  // Build a rich label with full bank details for admin visibility
  const bankLabel = resolvedBankRows.length > 0
    ? `${resolvedBankRows[0].bank_name} | Acct: ${resolvedBankRows[0].account_number} | Name: ${resolvedBankRows[0].account_name}`
    : bank;

  const updated = await sql`
    UPDATE users
    SET balance = balance - ${amt}
    WHERE id = ${session.userId}
      AND balance >= ${amt}
    RETURNING balance, email, full_name
  `;
  if (updated.length === 0) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const withdrawalRows = await sql`
    INSERT INTO transactions (user_id, type, amount, label, status)
    VALUES (${session.userId}, 'debit', ${amt}, ${"Withdrawal to " + bankLabel}, 'pending')
    RETURNING id
  `;

  await createContributorNotification({
    userId: session.userId,
    type: "withdrawal_update",
    title: "Withdrawal request received",
    message: `Your withdrawal request for ${amt.toLocaleString()} QLT is pending review.`,
    href: "/wallet",
    dedupeKey: `withdrawal:${withdrawalRows[0].id}:pending`,
    metadata: { transactionId: Number(withdrawalRows[0].id), amount: amt },
  });

  // Send withdrawal confirmation email (non-blocking)
  sendWithdrawalRequestedEmail(updated[0].email, updated[0].full_name, amt, bankLabel).catch(() => {});
  return NextResponse.json({ ok: true, newBalance: updated[0].balance });
}
