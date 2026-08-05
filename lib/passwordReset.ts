import crypto from "crypto";
import { sql } from "@/lib/db";

export type PasswordResetAccountType = "contributor" | "business";

export async function ensurePasswordResetSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS account_password_resets (
      token TEXT PRIMARY KEY,
      account_type TEXT NOT NULL CHECK (account_type IN ('contributor','business')),
      account_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS account_password_resets_account_idx
    ON account_password_resets (account_type, account_id)
  `;
}

export async function createPasswordResetToken(
  accountType: PasswordResetAccountType,
  accountId: number,
  email: string,
) {
  await ensurePasswordResetSchema();
  const token = crypto.randomBytes(32).toString("hex");

  await sql`
    DELETE FROM account_password_resets
    WHERE account_type = ${accountType} AND account_id = ${accountId}
  `;
  await sql`
    INSERT INTO account_password_resets (token, account_type, account_id, email, expires_at)
    VALUES (${token}, ${accountType}, ${accountId}, ${email}, NOW() + INTERVAL '15 minutes')
  `;

  return token;
}
