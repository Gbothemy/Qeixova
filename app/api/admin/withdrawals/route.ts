import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { ensureAdminPlatformTables, getAdminContext, logAdminAction } from "@/lib/adminPlatform";

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req,"withdrawals.read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const withdrawals = status
    ? await sql`
        SELECT t.id, t.amount, t.label, t.status, t.created_at,
          u.full_name AS user_name, u.email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE t.type = 'debit' AND t.status = ${status}
        ORDER BY t.created_at DESC
        LIMIT 100
      `
    : await sql`
        SELECT t.id, t.amount, t.label, t.status, t.created_at,
          u.full_name AS user_name, u.email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE t.type = 'debit'
        ORDER BY t.created_at DESC
        LIMIT 100
      `;

  await ensureAdminPlatformTables();
  const reconciliation=await sql`SELECT * FROM payout_reconciliation WHERE transaction_id=ANY(${withdrawals.map(row=>Number(row.id))})`;
  return NextResponse.json({ withdrawals: withdrawals.map(row=>({...row,reconciliation:reconciliation.find(item=>Number(item.transaction_id)===Number(row.id))??null})) });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req,"withdrawals.manage")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, providerReference, financeNote, recipientVerified } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const actor=await getAdminContext();
  const before=await sql`SELECT id,user_id,amount,status,label FROM transactions WHERE id=${id} AND type='debit'`;
  await ensureAdminPlatformTables();
  if (action === "approve") {
    if(!providerReference||!recipientVerified) return NextResponse.json({error:"Recipient verification and a payment-provider reference are required"},{status:400});
    const thresholdRows=await sql`SELECT value FROM system_config WHERE key='dual_approval_withdrawal_qlt'`;
    const dualApprovalThreshold=Number(thresholdRows[0]?.value??1000000);
    if(Number(before[0]?.amount)>=dualApprovalThreshold){
      if(!actor?.id)return NextResponse.json({error:"High-value payouts require an individual administrator account"},{status:403});
      const reviews=await sql`SELECT first_approved_by,second_approved_by FROM payout_reconciliation WHERE transaction_id=${Number(id)}`;
      if(!reviews[0]?.first_approved_by){
        await sql`INSERT INTO payout_reconciliation(transaction_id,provider_reference,recipient_verified,reconciliation_status,finance_note,first_approved_by) VALUES (${Number(id)},${String(providerReference)},TRUE,'awaiting_second_approval',${String(financeNote??"")},${actor.id}) ON CONFLICT(transaction_id) DO UPDATE SET provider_reference=EXCLUDED.provider_reference,recipient_verified=TRUE,reconciliation_status='awaiting_second_approval',finance_note=EXCLUDED.finance_note,first_approved_by=EXCLUDED.first_approved_by,updated_at=NOW()`;
        await logAdminAction({action:"withdrawal.first_approval",entityType:"withdrawal",entityId:id,before:before[0],after:{providerReference},reason:financeNote},actor);
        return NextResponse.json({ok:true,pendingSecondApproval:true,message:"First approval recorded. A different Finance or Super Admin must provide the second approval."},{status:202});
      }
      if(Number(reviews[0].first_approved_by)===actor.id)return NextResponse.json({error:"A different administrator must provide the second approval"},{status:409});
      await sql`UPDATE payout_reconciliation SET second_approved_by=${actor.id},updated_at=NOW() WHERE transaction_id=${Number(id)}`;
    }
    await sql`UPDATE transactions SET status = 'completed' WHERE id = ${id} AND type = 'debit'`;
    await sql`INSERT INTO payout_reconciliation(transaction_id,provider_reference,recipient_verified,reconciliation_status,finance_note,first_approved_by) VALUES (${Number(id)},${String(providerReference)},TRUE,'reconciled',${String(financeNote??"")},${actor?.id??null}) ON CONFLICT(transaction_id) DO UPDATE SET provider_reference=EXCLUDED.provider_reference,recipient_verified=TRUE,reconciliation_status='reconciled',finance_note=EXCLUDED.finance_note,updated_at=NOW()`;
  } else if (action === "processing") {
    await sql`UPDATE transactions SET status = 'processing' WHERE id = ${id} AND type = 'debit'`;
  } else if (action === "reject") {
    // Refund QLT to user
    const rows = await sql`SELECT user_id, amount FROM transactions WHERE id = ${id} AND type = 'debit'`;
    if (rows.length > 0) {
      const { user_id, amount } = rows[0];
      await sql`UPDATE transactions SET status = 'failed' WHERE id = ${id}`;
      await sql`UPDATE users SET balance = balance + ${amount} WHERE id = ${user_id}`;
      await sql`
        INSERT INTO transactions (user_id, type, amount, label, status)
        VALUES (${user_id}, 'credit', ${amount}, 'Withdrawal Refund', 'completed')
      `;
    }
  } else if(action === "retry"){
    await sql`UPDATE transactions SET status='processing' WHERE id=${id} AND type='debit' AND status='failed'`;
    await sql`INSERT INTO payout_reconciliation(transaction_id,reconciliation_status,retry_count,finance_note) VALUES (${Number(id)},'retrying',1,${String(financeNote??"")}) ON CONFLICT(transaction_id) DO UPDATE SET reconciliation_status='retrying',retry_count=payout_reconciliation.retry_count+1,finance_note=EXCLUDED.finance_note,updated_at=NOW()`;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await logAdminAction({action:`withdrawal.${action}`,entityType:"withdrawal",entityId:id,before:before[0],after:{status:action,providerReference,recipientVerified},reason:financeNote},actor);

  return NextResponse.json({ ok: true });
}
