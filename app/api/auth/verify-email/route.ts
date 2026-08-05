import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureEmailVerificationSchema } from "@/lib/emailVerification";
import { sendBusinessWelcomeEmail, sendWelcomeEmail } from "@/lib/email";
import { createContributorNotification } from "@/lib/contributorNotifications";

function redirectTo(req: NextRequest, path: string, params: Record<string, string>) {
  const url = new URL(path, req.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return redirectTo(req, "/login", { verify_error: "missing" });
    }

    await ensureEmailVerificationSchema();

    const rows = await sql`
      SELECT account_type, account_id, email
      FROM email_verifications
      WHERE token = ${token} AND expires_at > NOW()
      LIMIT 1
    `;

    if (rows.length === 0) {
      return redirectTo(req, "/login", { verify_error: "expired" });
    }

    const record = rows[0];

    if (record.account_type === "business") {
      const updated = await sql`
        UPDATE businesses
        SET email_verified = TRUE, email_verified_at = NOW()
        WHERE id = ${record.account_id}
        RETURNING name, email
      `;
      await sql`DELETE FROM email_verifications WHERE token = ${token}`;
      if (updated[0]) {
        sendBusinessWelcomeEmail(updated[0].email, updated[0].name).catch(() => {});
      }
      return redirectTo(req, "/business/login", { verified: "1" });
    }

    const updated = await sql`
      UPDATE users
      SET email_verified = TRUE, email_verified_at = NOW()
      WHERE id = ${record.account_id}
      RETURNING id, full_name, email, referred_by
    `;
    await sql`DELETE FROM email_verifications WHERE token = ${token}`;
    if (updated[0]) {
      const user = updated[0];
      if (user.referred_by) {
        await sql`UPDATE users SET balance = balance + 2500 WHERE id = ${user.referred_by}`;
        await sql`
          INSERT INTO transactions (user_id, type, amount, label)
          VALUES (${user.referred_by}, 'credit', 2500, 'Referral Bonus')
        `;
        await sql`UPDATE users SET balance = balance + 1000 WHERE id = ${user.id}`;
        await sql`
          INSERT INTO transactions (user_id, type, amount, label)
          VALUES (${user.id}, 'credit', 1000, 'Welcome Bonus')
        `;
      }
      await createContributorNotification({
        userId: Number(user.id),
        type: "account_update",
        title: "Account verified",
        message: "Your contributor account email has been verified. You can now access matched missions and wallet features.",
        href: "/dashboard",
        dedupeKey: `account:${user.id}:verified`,
        metadata: { verified: true },
      });
      sendWelcomeEmail(updated[0].email, updated[0].full_name).catch(() => {});
    }

    return redirectTo(req, "/login", { verified: "1" });
  } catch (err) {
    console.error(err);
    return redirectTo(req, "/login", { verify_error: "server" });
  }
}
