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

async function removeUnverifiedRegistration(userId: number) {
  // A contributor cannot sign in before email verification. If delivery fails,
  // remove this incomplete account so the email can be registered again.
  await sql`DELETE FROM email_verifications WHERE account_type = 'contributor' AND account_id = ${userId}`;
  await sql`UPDATE users SET referred_by = NULL WHERE referred_by = ${userId}`;
  await sql`DELETE FROM users WHERE id = ${userId} AND email_verified = FALSE`;
}

export async function POST(req: NextRequest) {
  let createdUserId: number | null = null;
  try {
    const { email, phone, fullName, password, referralCode } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    await ensureEmailVerificationSchema();

    // A prior attempt may have created an account before the email provider
    // failed. Clear only unverified records so this address can register again.
    const existing = await sql`SELECT id, email_verified FROM users WHERE email = ${cleanEmail}`;
    if (existing.length > 0) {
      if (existing[0].email_verified === false) {
        await removeUnverifiedRegistration(Number(existing[0].id));
      } else {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
    }

    // Referral code is optional
    let referrerId: number | null = null;
    if (referralCode && referralCode.trim()) {
      const refRows = await sql`SELECT id FROM users WHERE referral_code = ${referralCode.trim().toUpperCase()}`;
      if (refRows.length === 0) {
        return NextResponse.json({ error: "Invalid referral code. Please check and try again." }, { status: 400 });
      }
      referrerId = refRows[0].id;
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
    createdUserId = Number(user.id);
    // The required awareness mission is provisioned by mission discovery.
    // Keep signup independent from campaign/task writes: registration must not
    // fail or remain loading when that separate provisioning work is delayed.

    const verificationToken = await createEmailVerification("contributor", user.id, user.email);
    const emailSent = await sendEmailVerificationEmail(user.email, user.full_name, verificationToken);
    if (!emailSent) {
      await removeUnverifiedRegistration(createdUserId);
      createdUserId = null;
      return NextResponse.json({
        error: "Verification email could not be sent, so your account was not saved. Please register again after email service is available.",
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      requiresVerification: true,
      user: { id: user.id, email: user.email, fullName: user.full_name },
    });
  } catch (err) {
    if (createdUserId) {
      try {
        await removeUnverifiedRegistration(createdUserId);
      } catch (cleanupError) {
        console.error("Could not remove incomplete growth partner registration", cleanupError);
      }
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
