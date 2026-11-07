import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";
import { createEmailVerification, ensureEmailVerificationSchema } from "@/lib/emailVerification";
import { sendEmailVerificationEmail } from "@/lib/email";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req, "accounts.read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureEmailVerificationSchema();
    const searchParams = req.nextUrl.searchParams;
    const search = (searchParams.get("search") ?? "").trim();
    const verified = searchParams.get("verified") === "true";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const offset = (page - 1) * PAGE_SIZE;
    const q = `%${search}%`;

    const [users, countRows] = await Promise.all([
      sql`
        SELECT id, account_type, full_name, email, created_at, email_verified_at, verification_created_at, reminder_sent_at, verification_expires_at
        FROM (
          SELECT u.id, 'contributor'::text AS account_type, u.full_name, u.email, u.created_at, u.email_verified_at,
            u.email_verified AS is_verified,
            ev.created_at AS verification_created_at, ev.reminder_sent_at, ev.expires_at AS verification_expires_at
          FROM users u
          LEFT JOIN email_verifications ev ON ev.account_type = 'contributor' AND ev.account_id = u.id
          WHERE u.email_verified = ${verified}
          UNION ALL
          SELECT b.id, 'business'::text AS account_type, b.name AS full_name, b.email, b.created_at, b.email_verified_at,
            b.email_verified AS is_verified,
            ev.created_at AS verification_created_at, ev.reminder_sent_at, ev.expires_at AS verification_expires_at
          FROM businesses b
          LEFT JOIN email_verifications ev ON ev.account_type = 'business' AND ev.account_id = b.id
          WHERE b.email_verified = ${verified}
        ) unverified
        WHERE ${search} = '' OR full_name ILIKE ${q} OR email ILIKE ${q}
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT full_name, email FROM users WHERE email_verified = ${verified}
          UNION ALL
          SELECT name AS full_name, email FROM businesses WHERE email_verified = ${verified}
        ) unverified
        WHERE ${search} = '' OR full_name ILIKE ${q} OR email ILIKE ${q}
      `,
    ]);

    return NextResponse.json({ users, total: countRows[0]?.total ?? 0 });
  } catch (error) {
    console.error("Could not load unverified accounts", error);
    return NextResponse.json({ error: "Could not load unverified accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req, "accounts.manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const accountId = Number(body.id);
    const accountType = body.accountType;
    if (!Number.isSafeInteger(accountId) || accountId < 1 || !["contributor", "business"].includes(accountType)) {
      return NextResponse.json({ error: "A valid account is required" }, { status: 400 });
    }

    await ensureEmailVerificationSchema();
    const account = accountType === "business"
      ? (await sql`SELECT id, name AS full_name, email FROM businesses WHERE id = ${accountId} AND email_verified = FALSE LIMIT 1`)[0]
      : (await sql`SELECT id, full_name, email FROM users WHERE id = ${accountId} AND email_verified = FALSE LIMIT 1`)[0];

    if (!account) {
      return NextResponse.json({ error: "This account is already verified or no longer exists." }, { status: 404 });
    }

    const activeWindow = await sql`
      SELECT 1 FROM email_verifications
      WHERE account_type = ${accountType} AND account_id = ${accountId} AND expires_at > NOW()
      LIMIT 1
    `;
    if (activeWindow.length > 0) {
      return NextResponse.json({ error: "Wait for the current 24-hour verification window to expire before sending another reminder." }, { status: 409 });
    }

    const previousVerification = (await sql`
      SELECT token, expires_at, created_at, reminder_sent_at
      FROM email_verifications
      WHERE account_type = ${accountType} AND account_id = ${accountId}
      LIMIT 1
    `)[0] ?? null;
    const token = await createEmailVerification(accountType, accountId, account.email);
    await sql`
      UPDATE email_verifications
      SET reminder_sent_at = NOW()
      WHERE account_type = ${accountType} AND account_id = ${accountId}
    `;
    const sent = await sendEmailVerificationEmail(account.email, account.full_name || "there", token, true);
    if (!sent) {
      if (previousVerification) {
        await sql`
          UPDATE email_verifications
          SET token = ${previousVerification.token}, expires_at = ${previousVerification.expires_at},
            created_at = ${previousVerification.created_at}, reminder_sent_at = ${previousVerification.reminder_sent_at}
          WHERE account_type = ${accountType} AND account_id = ${accountId}
        `;
      } else {
        await sql`DELETE FROM email_verifications WHERE account_type = ${accountType} AND account_id = ${accountId}`;
      }
      return NextResponse.json({ error: "The reminder could not be sent. Check the email service configuration." }, { status: 503 });
    }

    await logAdminAction({
      action: "user.verification_reminder_sent",
      entityType: accountType,
      entityId: accountId,
      after: { email: account.email },
    }, await getAdminContext());

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not send verification reminder", error);
    return NextResponse.json({ error: "Could not send verification reminder" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdminAuth(req, "accounts.manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const accountId = Number(body.id);
    const accountType = body.accountType;
    if (!Number.isSafeInteger(accountId) || accountId < 1 || !["contributor", "business"].includes(accountType)) {
      return NextResponse.json({ error: "A valid account is required" }, { status: 400 });
    }

    await ensureEmailVerificationSchema();
    const activeWindow = await sql`
      SELECT 1 FROM email_verifications
      WHERE account_type = ${accountType} AND account_id = ${accountId} AND expires_at > NOW()
      LIMIT 1
    `;
    if (activeWindow.length > 0) {
      return NextResponse.json({ error: "This account can only be deleted after its 24-hour verification window expires." }, { status: 409 });
    }

    if (accountType === "contributor") {
      await sql`UPDATE users SET referred_by = NULL WHERE referred_by = ${accountId}`;
    }
    const deleted = accountType === "business"
      ? (await sql`DELETE FROM businesses WHERE id = ${accountId} AND email_verified = FALSE RETURNING id, email`)[0]
      : (await sql`DELETE FROM users WHERE id = ${accountId} AND email_verified = FALSE RETURNING id, email`)[0];

    if (!deleted) {
      return NextResponse.json({ error: "This account is already verified or no longer exists." }, { status: 404 });
    }

    await sql`DELETE FROM email_verifications WHERE account_type = ${accountType} AND account_id = ${accountId}`;
    await logAdminAction({
      action: "user.unverified_account_deleted",
      entityType: accountType,
      entityId: accountId,
      before: { email: deleted.email, email_verified: false },
      after: { deleted: true },
    }, await getAdminContext());

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not delete unverified account", error);
    return NextResponse.json({ error: "Could not delete unverified account. It may have related account data." }, { status: 500 });
  }
}
