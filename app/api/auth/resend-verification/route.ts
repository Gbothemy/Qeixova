import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import { createEmailVerification, ensureEmailVerificationSchema } from "@/lib/emailVerification";

export async function POST(req: NextRequest) {
  try {
    const { email, accountType } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    await ensureEmailVerificationSchema();

    const users = accountType === "business"
      ? []
      : await sql`
          SELECT id, email, full_name AS name, email_verified
          FROM users
          WHERE email = ${cleanEmail}
          LIMIT 1
        `;
    const businessTable = users.length === 0
      ? await sql`SELECT to_regclass('public.businesses') AS table_name`
      : [];
    const businesses = accountType === "contributor" || users.length > 0 || !businessTable[0]?.table_name
      ? []
      : await sql`
          SELECT id, email, name, email_verified
          FROM businesses
          WHERE email = ${cleanEmail}
          LIMIT 1
        `;

    const account = users[0] ?? businesses[0];
    if (!account) {
      return NextResponse.json({ ok: true });
    }
    if (account.email_verified) {
      return NextResponse.json({ ok: true, verified: true });
    }

    const type = users.length > 0 ? "contributor" : "business";
    const token = await createEmailVerification(type, account.id, account.email);
    const emailSent = await sendEmailVerificationEmail(account.email, account.name, token);
    if (!emailSent) {
      return NextResponse.json({
        error: "Verification email could not be sent. Check email service configuration.",
      }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
