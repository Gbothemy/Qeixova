import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { ensureEmailVerificationSchema } from "@/lib/emailVerification";
import { cleanLoginEmail, getPasswordCandidates } from "@/lib/loginInput";

export async function POST(req: NextRequest) {
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
    await ensureEmailVerificationSchema();
    const rows = await sql`SELECT * FROM users WHERE email = ${cleanEmail}`;
    if (rows.length === 0) {
      return fail("Invalid email or password", 401);
    }

    const user = rows[0];
    const valid = (await Promise.all(
      getPasswordCandidates(password).map((candidate) => bcrypt.compare(candidate, user.password)),
    )).some(Boolean);
    if (!valid) {
      return fail("Invalid email or password", 401);
    }
    if (user.email_verified === false) {
      return fail("Please verify your email before signing in. Check your inbox for the verification link.", 403);
    }

    // Update streak
    const today = new Date().toISOString().split("T")[0];
    const lastActive = user.last_active ? new Date(user.last_active).toISOString().split("T")[0] : null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak = lastActive === yesterday ? user.streak + 1 : lastActive === today ? user.streak : 1;

    await sql`UPDATE users SET streak = ${newStreak}, last_active = ${today} WHERE id = ${user.id}`;

    const token = signToken({ userId: user.id, email: user.email, fullName: user.full_name });

    const res = wantsJson
      ? NextResponse.json({
          ok: true,
          user: { id: user.id, email: user.email, fullName: user.full_name },
        })
      : NextResponse.redirect(new URL("/dashboard", req.url), 303);
    res.cookies.set("auth_token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
