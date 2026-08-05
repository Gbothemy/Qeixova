import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ensurePasswordResetSchema } from "@/lib/passwordReset";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    await ensurePasswordResetSchema();
    const rows = await sql`
      SELECT account_type, account_id
      FROM account_password_resets
      WHERE token = ${token} AND expires_at > NOW()
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Reset link has expired or already been used." }, { status: 400 });
    }

    const reset = rows[0];
    const hashed = await bcrypt.hash(password, 10);
    if (reset.account_type === "business") {
      await sql`UPDATE businesses SET password = ${hashed} WHERE id = ${reset.account_id}`;
    } else {
      await sql`UPDATE users SET password = ${hashed} WHERE id = ${reset.account_id}`;
    }
    await sql`DELETE FROM account_password_resets WHERE token = ${token}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
