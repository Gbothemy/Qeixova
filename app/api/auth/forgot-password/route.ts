import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/passwordReset";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const cleanEmail = String(email).toLowerCase().trim();
    const users = await sql`SELECT id, email, full_name AS name FROM users WHERE email = ${cleanEmail}`;
    const businessTable = users.length === 0
      ? await sql`SELECT to_regclass('public.businesses') AS table_name`
      : [];
    const businesses = users.length === 0 && businessTable[0]?.table_name
      ? await sql`SELECT id, email, name FROM businesses WHERE email = ${cleanEmail}`
      : [];

    // Always return success to prevent email enumeration
    if (users.length === 0 && businesses.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const account = users[0] ?? businesses[0];
    const accountType = users.length > 0 ? "contributor" : "business";
    const token = await createPasswordResetToken(accountType, account.id, account.email);

    await sendPasswordResetEmail(account.email, account.name, token);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
