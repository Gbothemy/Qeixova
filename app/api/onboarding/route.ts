import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canonicalizeInterests } from "@/lib/interestTaxonomy";

async function ensureBankAccountsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_name TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, account_number)
    )
  `;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`SELECT onboarding_completed FROM users WHERE id = ${session.userId}`;
  return NextResponse.json({ onboarding_completed: rows[0]?.onboarding_completed ?? false });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    bank_name, account_number, account_name, referralCode,
    profession, interests, age_range, gender, state,
  } = await req.json();

  const normalizedInterests = canonicalizeInterests(interests, 5);

  // Save bank account if provided
  if (bank_name && account_number && account_name) {
    await ensureBankAccountsTable();
    await sql`
      INSERT INTO bank_accounts (user_id, bank_name, account_number, account_name, is_default)
      VALUES (${session.userId}, ${bank_name}, ${account_number}, ${account_name}, TRUE)
      ON CONFLICT (user_id, account_number) DO NOTHING
    `;
  }

  // Save targeting profile
  await sql`
    UPDATE users SET
      profession   = ${profession || null},
      interests    = ${normalizedInterests},
      platforms    = ${[]},
      age_range    = ${age_range || null},
      gender       = ${gender || null},
      state        = ${state || null}
    WHERE id = ${session.userId}
  `;

  // Apply referral code if provided and user has no referrer yet
  if (referralCode && referralCode.trim()) {
    const refRows = await sql`SELECT id FROM users WHERE referral_code = ${referralCode.trim().toUpperCase()}`;
    if (refRows.length > 0) {
      const referrerId = refRows[0].id;
      const userRows = await sql`SELECT referred_by FROM users WHERE id = ${session.userId}`;
      if (!userRows[0]?.referred_by) {
        await sql`UPDATE users SET referred_by = ${referrerId} WHERE id = ${session.userId}`;
        await sql`UPDATE users SET balance = balance + 2500 WHERE id = ${referrerId}`;
        await sql`
          INSERT INTO transactions (user_id, type, amount, label)
          VALUES (${referrerId}, 'credit', 2500, 'Referral Bonus')
        `;
        // New user gets 1000 QLT welcome bonus when referred
        await sql`UPDATE users SET balance = 1000 WHERE id = ${session.userId}`;
        await sql`
          INSERT INTO transactions (user_id, type, amount, label)
          VALUES (${session.userId}, 'credit', 1000, 'Welcome Bonus')
        `;
      }
    }
  }

  // Mark onboarding complete
  await sql`UPDATE users SET onboarding_completed = TRUE WHERE id = ${session.userId}`;

  return NextResponse.json({ ok: true });
}
