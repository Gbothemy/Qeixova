import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

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
  await ensureBankAccountsTable();

  const accounts = await sql`
    SELECT id, bank_name, account_number, account_name, is_default, created_at
    FROM bank_accounts
    WHERE user_id = ${session.userId}
    ORDER BY is_default DESC, created_at ASC
  `;
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureBankAccountsTable();

  const { bankName, accountNumber, accountName } = await req.json();

  if (!bankName || !accountNumber || !accountName) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json({ error: "Account number must be exactly 10 digits" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id FROM bank_accounts
    WHERE user_id = ${session.userId} AND account_number = ${accountNumber}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "This account number is already saved" }, { status: 409 });
  }

  const countRows = await sql`
    SELECT COUNT(*)::int AS c FROM bank_accounts WHERE user_id = ${session.userId}
  `;
  const isFirst = countRows[0].c === 0;

  const result = await sql`
    INSERT INTO bank_accounts (user_id, bank_name, account_number, account_name, is_default)
    VALUES (${session.userId}, ${bankName}, ${accountNumber}, ${accountName}, ${isFirst})
    RETURNING id, bank_name, account_number, account_name, is_default
  `;
  return NextResponse.json({ ok: true, account: result[0] });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureBankAccountsTable();

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await sql`
    DELETE FROM bank_accounts WHERE id = ${id} AND user_id = ${session.userId}
  `;

  // If deleted account was default, promote the next one
  await sql`
    UPDATE bank_accounts SET is_default = TRUE
    WHERE user_id = ${session.userId}
      AND id = (SELECT id FROM bank_accounts WHERE user_id = ${session.userId} ORDER BY created_at ASC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE user_id = ${session.userId} AND is_default = TRUE)
  `;

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureBankAccountsTable();

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await sql`UPDATE bank_accounts SET is_default = FALSE WHERE user_id = ${session.userId}`;
  await sql`UPDATE bank_accounts SET is_default = TRUE  WHERE id = ${id} AND user_id = ${session.userId}`;

  return NextResponse.json({ ok: true });
}
