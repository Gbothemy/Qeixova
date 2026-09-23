import { NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";

export async function POST() {
  const session=await getBusinessSession(); if(session?.sessionId) await sql`UPDATE business_sessions SET revoked_at=NOW() WHERE id=${session.sessionId}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.set("business_token", "", { maxAge: 0, path: "/" });
  return res;
}
