/**
 * Email service — uses Gmail SMTP via nodemailer.
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.
 */
import nodemailer from "nodemailer";
import { formatNairaFromQlt } from "@/lib/currency";

const PRODUCTION_APP_URL = "https://qeixova.vercel.app";
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? process.env.EMAIL_USER ?? GMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS ?? process.env.EMAIL_PASS ?? GMAIL_PASS;
const MAIL_FROM = process.env.MAIL_FROM ?? process.env.EMAIL_FROM ?? SMTP_USER ?? GMAIL_USER;

function getAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") continue;
      url.pathname = url.pathname.replace(/\/+$/, "");
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      // Ignore malformed environment values and keep looking.
    }
  }

  return PRODUCTION_APP_URL;
}

const APP_URL = getAppUrl();

function getTransporter() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  if (!GMAIL_USER || !GMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`\n📧 [EMAIL - no credentials] To: ${to} | Subject: ${subject}\n`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: MAIL_FROM?.includes("<") ? MAIL_FROM : `"Qeixova" <${MAIL_FROM}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    return false;
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail(to, "Welcome to Qeixova — Start Earning!", `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:22px;font-weight:900;color:#F5F5F5;margin:0 0 8px">Welcome, ${name}! 🎉</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Your Qeixova account is ready. Complete missions, earn QLT, and convert to real Naira.</p>
      <a href="${APP_URL}/tasks" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#F5A623,#d89420);color:#000;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:800;font-size:14px">Browse Missions →</a>
      <p style="color:#333;font-size:12px;margin-top:28px">10 QLT = ₦1 · Transparent · No hidden fees</p>
    </div>
  `);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail(to, "Reset your Qeixova password", `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:20px;font-weight:900;color:#F5F5F5;margin:0 0 8px">Password Reset</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Hi ${name}, click the button below to reset your password. This link expires in 15 minutes.</p>
      <a href="${resetUrl}" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#1AEF22,#06B517);color:#000;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:800;font-size:14px">Reset Password →</a>
      <p style="color:#333;font-size:12px;margin-top:28px">If you didn't request this, ignore this email.</p>
    </div>
  `);
}

export async function sendEmailVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  return sendEmail(to, "Verify your Qeixova email", `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:20px;font-weight:900;color:#F5F5F5;margin:0 0 8px">Verify your email</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Hi ${name}, confirm this email address to activate your Qeixova account. This link expires in 24 hours.</p>
      <a href="${verifyUrl}" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#1AEF22,#06B517);color:#000;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:800;font-size:14px">Verify Email</a>
      <p style="color:#333;font-size:12px;margin-top:28px">If you did not create this account, you can ignore this email.</p>
    </div>
  `);
}

export async function sendMissionApprovedEmail(to: string, name: string, missionTitle: string, reward: number): Promise<void> {
  await sendEmail(to, `✅ Mission Approved — ${reward.toLocaleString()} QLT Credited`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:20px;font-weight:900;color:#1AEF22;margin:0 0 8px">Mission Approved! ✅</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Hi ${name}, your submission for <strong style="color:#F5F5F5">${missionTitle}</strong> has been approved.</p>
      <div style="background:#111;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #222">
        <p style="color:#888;font-size:12px;margin:0 0 4px">QLT Credited</p>
        <p style="color:#F5A623;font-size:28px;font-weight:900;margin:0">+${reward.toLocaleString()} QLT</p>
        <p style="color:#555;font-size:12px;margin:4px 0 0">≈ ₦${formatNairaFromQlt(reward, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <a href="${APP_URL}/wallet" style="display:inline-block;background:linear-gradient(135deg,#F5A623,#d89420);color:#000;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:800;font-size:14px">View Wallet →</a>
    </div>
  `);
}

export async function sendMissionRejectedEmail(to: string, name: string, missionTitle: string, reason: string): Promise<void> {
  await sendEmail(to, `Mission Submission Update — ${missionTitle}`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:20px;font-weight:900;color:#e53e3e;margin:0 0 8px">Submission Not Approved</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Hi ${name}, your submission for <strong style="color:#F5F5F5">${missionTitle}</strong> was not approved.</p>
      <div style="background:#111;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #222">
        <p style="color:#888;font-size:12px;margin:0 0 4px">Reason</p>
        <p style="color:#F5F5F5;font-size:14px;margin:0">${reason}</p>
      </div>
      <p style="color:#555;font-size:13px">Please review the mission requirements and try again.</p>
      <a href="${APP_URL}/tasks" style="display:inline-block;margin-top:16px;background:#111;border:1px solid #333;color:#F5F5F5;text-decoration:none;padding:12px 24px;border-radius:11px;font-weight:600;font-size:14px">Browse Missions →</a>
    </div>
  `);
}

export async function sendWithdrawalRequestedEmail(to: string, name: string, amount: number, bankLabel: string): Promise<void> {
  await sendEmail(to, `Withdrawal Request Received — ₦${formatNairaFromQlt(amount)}`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:20px;font-weight:900;color:#F5F5F5;margin:0 0 8px">Withdrawal Requested 💸</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Hi ${name}, your withdrawal request has been received and is being processed.</p>
      <div style="background:#111;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #222">
        <p style="color:#888;font-size:12px;margin:0 0 4px">Amount</p>
        <p style="color:#F5A623;font-size:24px;font-weight:900;margin:0 0 8px">₦${formatNairaFromQlt(amount)}</p>
        <p style="color:#888;font-size:12px;margin:0 0 4px">To</p>
        <p style="color:#F5F5F5;font-size:13px;margin:0">${bankLabel}</p>
      </div>
      <p style="color:#555;font-size:12px">Processing within 24 hours. Contact support if not received.</p>
    </div>
  `);
}

export async function sendBusinessWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail(to, "Welcome to Qeixova Business Portal", `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:22px;font-weight:900;color:#F5A623;margin:0 0 8px">Welcome, ${name}!</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Your business account is ready. Create campaigns, target your audience, and pay only for verified completions.</p>
      <a href="${APP_URL}/business/tasks/new" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#F5A623,#d89420);color:#000;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:800;font-size:14px">Create First Campaign →</a>
    </div>
  `);
}

export async function sendCampaignLiveEmail(to: string, businessName: string, campaignTitle: string): Promise<void> {
  await sendEmail(to, `Campaign Live: ${campaignTitle}`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#000;color:#F5F5F5;padding:32px;border-radius:16px">
      <img src="${APP_URL}/qeixova-icon.png" width="48" style="border-radius:12px;margin-bottom:20px" />
      <h1 style="font-size:20px;font-weight:900;color:#1AEF22;margin:0 0 8px">Campaign is Live! 🚀</h1>
      <p style="color:#888;font-size:14px;line-height:1.7">Hi ${businessName}, your campaign <strong style="color:#F5F5F5">${campaignTitle}</strong> has been approved and is now visible to your target audience.</p>
      <a href="${APP_URL}/business/tasks" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#F5A623,#d89420);color:#000;text-decoration:none;padding:13px 28px;border-radius:11px;font-weight:800;font-size:14px">View Campaign →</a>
    </div>
  `);
}

