import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { sql } from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (session) {
    try { await sql`UPDATE admin_sessions SET revoked_at=NOW() WHERE token_hash=${createHash("sha256").update(session).digest("hex")}`; } catch { /* cookie is still cleared */ }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", "", { maxAge: 0, path: "/" });
  res.cookies.set("admin_session", "", { maxAge: 0, path: "/" });
  return res;
}
