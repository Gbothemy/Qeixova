import crypto from "crypto";
import { sql } from "@/lib/db";

export type VerificationAccountType = "contributor" | "business";

export async function ensureEmailVerificationSchema() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`;
  await sql`ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`;
  await sql`
    CREATE TABLE IF NOT EXISTS email_verifications (
      account_type TEXT NOT NULL CHECK (account_type IN ('contributor','business')),
      account_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (account_type, account_id)
    )
  `;
}

export async function createEmailVerification(
  accountType: VerificationAccountType,
  accountId: number,
  email: string,
) {
  await ensureEmailVerificationSchema();
  const token = crypto.randomBytes(32).toString("hex");

  await sql`
    INSERT INTO email_verifications (account_type, account_id, email, token, expires_at)
    VALUES (${accountType}, ${accountId}, ${email}, ${token}, NOW() + INTERVAL '24 hours')
    ON CONFLICT (account_type, account_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      token = EXCLUDED.token,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
  `;

  return token;
}
