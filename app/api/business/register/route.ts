import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import { createEmailVerification, ensureEmailVerificationSchema } from "@/lib/emailVerification";

async function ensureBusinessRegistrationColumns() {
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await ensureEmailVerificationSchema();
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, industry, website } = await req.json();
    if (!name || !email || !password) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const cleanEmail = String(email).trim().toLowerCase();

    await ensureBusinessRegistrationColumns();

    const existing = await sql`SELECT id FROM businesses WHERE email = ${cleanEmail}`;
    if (existing.length > 0) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO businesses (name, email, password, industry, website, email_verified)
      VALUES (${name}, ${cleanEmail}, ${hashed}, ${industry || null}, ${website || null}, FALSE)
      RETURNING id, name, email
    `;

    const business = result[0];
    const verificationToken = await createEmailVerification("business", business.id, business.email);
    const emailSent = await sendEmailVerificationEmail(business.email, business.name, verificationToken);
    if (!emailSent) {
      return NextResponse.json({
        error: "Account created, but the verification email could not be sent. Please use resend verification or contact support.",
        requiresVerification: true,
        email: business.email,
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      requiresVerification: true,
      business: { id: business.id, name: business.name, email: business.email },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
