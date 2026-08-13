import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { cleanLoginEmail, getPasswordCandidates } from "@/lib/loginInput";

export async function POST(req: NextRequest) {
  let stage = "parse_request";
  try {
    const contentType = req.headers.get("content-type") || "";
    const wantsJson = contentType.includes("application/json");
    const payload = wantsJson
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());
    const { email, password } = payload;

    const fail = (message: string, status: number) => {
      if (wantsJson) {
        return NextResponse.json({ error: message }, { status });
      }
      const url = new URL("/login", req.url);
      url.searchParams.set("error", message);
      return NextResponse.redirect(url, 303);
    };

    if (!email || !password) {
      return fail("Email and password required", 400);
    }

    const cleanEmail = cleanLoginEmail(email);
    stage = "load_user";
    const rows = await sql`SELECT * FROM users WHERE email = ${cleanEmail}`;
    if (rows.length === 0) {
      return fail("Invalid email or password", 401);
    }

    const user = rows[0];
    stage = "verify_password";
    const valid = (await Promise.all(
      getPasswordCandidates(password).map((candidate) => bcrypt.compare(candidate, user.password)),
    )).some(Boolean);
    if (!valid) {
      return fail("Invalid email or password", 401);
    }
    if (user.email_verified === false) {
      return fail("Please verify your email before signing in. Check your inbox for the verification link.", 403);
    }

    stage = "update_streak";
    await sql`
      UPDATE users
      SET streak = CASE
            WHEN last_active = CURRENT_DATE THEN streak
            WHEN last_active = CURRENT_DATE - 1 THEN streak + 1
            ELSE 1
          END,
          last_active = CURRENT_DATE
      WHERE id = ${user.id}
    `;

    stage = "sign_session";
    const token = signToken({ userId: user.id, email: user.email, fullName: user.full_name });

    const res = wantsJson
      ? NextResponse.json({
          ok: true,
          user: { id: user.id, email: user.email, fullName: user.full_name },
        })
      : NextResponse.redirect(new URL("/dashboard", req.url), 303);
    stage = "set_cookie";
    res.cookies.set("auth_token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    return res;
  } catch (err) {
    console.error("Contributor login failed", { stage, error: err });
    return NextResponse.json({
      error: process.env.NODE_ENV === "production" ? "Server error" : `Server error (${stage})`,
    }, { status: 500 });
  }
}
