import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signBusinessToken } from "@/lib/businessAuth";
import { cleanLoginEmail, getPasswordCandidates } from "@/lib/loginInput";

export async function POST(req: NextRequest) {
  let stage = "parse_request";
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const cleanEmail = cleanLoginEmail(email);
    stage = "load_business";
    const rows = await sql`SELECT * FROM businesses WHERE email = ${cleanEmail}`;
    if (rows.length === 0) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const business = rows[0];
    stage = "verify_password";
    const valid = (await Promise.all(
      getPasswordCandidates(password).map((candidate) => bcrypt.compare(candidate, business.password)),
    )).some(Boolean);
    if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    if (business.email_verified === false) {
      return NextResponse.json({ error: "Please verify your email before signing in. Check your inbox for the verification link." }, { status: 403 });
    }

    stage = "sign_session";
    const token = signBusinessToken({ businessId: business.id, email: business.email, name: business.name });

    stage = "set_cookie";
    const res = NextResponse.json({ ok: true, business: { id: business.id, name: business.name, email: business.email } });
    res.cookies.set("business_token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    return res;
  } catch (err) {
    console.error("Business login failed", { stage, error: err });
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: process.env.NODE_ENV === "production" ? "Server error" : `Server error (${stage})`,
      ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
    }, { status: 500 });
  }
}
