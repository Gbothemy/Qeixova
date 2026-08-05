import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import { createEmailVerification, ensureEmailVerificationSchema } from "@/lib/emailVerification";
import { getStartingLevelId } from "@/lib/levels";

function makeReferralCode(name: string): string {
  const prefix = name.slice(0, 4).toUpperCase().replace(/\s/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, phone, fullName, password, referralCode } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    await ensureEmailVerificationSchema();

    // Referral code is optional
    let referrerId: number | null = null;
    if (referralCode && referralCode.trim()) {
      const refRows = await sql`SELECT id FROM users WHERE referral_code = ${referralCode.trim().toUpperCase()}`;
      if (refRows.length === 0) {
        return NextResponse.json({ error: "Invalid referral code. Please check and try again." }, { status: 400 });
      }
      referrerId = refRows[0].id;
    }

    // Check existing user
    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const myCode = makeReferralCode(fullName);
    const startingLevelId = await getStartingLevelId();

    const result = await sql`
      INSERT INTO users (email, phone, full_name, password, referral_code, referred_by, balance, level, level_id, email_verified)
      VALUES (${cleanEmail}, ${phone || null}, ${fullName}, ${hashed}, ${myCode}, ${referrerId}, 0, 1, ${startingLevelId}, FALSE)
      RETURNING id, email, full_name
    `;

    const user = result[0];

    const verificationToken = await createEmailVerification("contributor", user.id, user.email);
    const emailSent = await sendEmailVerificationEmail(user.email, user.full_name, verificationToken);
    if (!emailSent) {
      return NextResponse.json({
        error: "Account created, but the verification email could not be sent. Please use resend verification or contact support.",
        requiresVerification: true,
        email: user.email,
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      requiresVerification: true,
      user: { id: user.id, email: user.email, fullName: user.full_name },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
