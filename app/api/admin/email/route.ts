import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";
import { isEmailDeliveryConfigured, sendAdminMessageEmail } from "@/lib/email";

const MAX_RECIPIENTS_PER_SEND = 100;

function validAudience(value: unknown): value is "contributors" | "businesses" {
  return value === "contributors" || value === "businesses";
}

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req, "accounts.read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const audience = searchParams.get("audience");
  if (!validAudience(audience)) return NextResponse.json({ error: "Choose contributors or businesses." }, { status: 400 });

  const search = (searchParams.get("search") ?? "").trim().slice(0, 120);
  const pattern = `%${search}%`;
  const recipients = audience === "contributors"
    ? await sql`
        SELECT id, full_name AS name, email
        FROM users
        WHERE NULLIF(TRIM(email), '') IS NOT NULL
          AND (${search} = '' OR full_name ILIKE ${pattern} OR email ILIKE ${pattern})
        ORDER BY full_name, id
        LIMIT ${MAX_RECIPIENTS_PER_SEND}
      `
    : await sql`
        SELECT id, name, email
        FROM businesses
        WHERE NULLIF(TRIM(email), '') IS NOT NULL
          AND (${search} = '' OR name ILIKE ${pattern} OR email ILIKE ${pattern})
        ORDER BY name, id
        LIMIT ${MAX_RECIPIENTS_PER_SEND}
      `;

  return NextResponse.json({ recipients, limit: MAX_RECIPIENTS_PER_SEND, deliveryConfigured: isEmailDeliveryConfigured() });
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req, "accounts.manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json({ error: "Email delivery is not configured. Set the SMTP or Gmail credentials for this app." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const audience = body.audience;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const ids = Array.isArray(body.recipientIds)
    ? [...new Set(body.recipientIds.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))] as number[]
    : [];

  if (!validAudience(audience)) return NextResponse.json({ error: "Choose contributors or businesses." }, { status: 400 });
  if (!subject || subject.length > 180 || /[\r\n]/.test(subject)) return NextResponse.json({ error: "Enter a subject between 1 and 180 characters on a single line." }, { status: 400 });
  if (!message || message.length > 12000) return NextResponse.json({ error: "Enter a message between 1 and 12,000 characters." }, { status: 400 });
  if (ids.length === 0) return NextResponse.json({ error: "Select at least one recipient." }, { status: 400 });
  if (ids.length > MAX_RECIPIENTS_PER_SEND) return NextResponse.json({ error: `Send to up to ${MAX_RECIPIENTS_PER_SEND} recipients at a time.` }, { status: 400 });

  const recipients = audience === "contributors"
    ? await sql`SELECT id, full_name AS name, email FROM users WHERE id = ANY(${ids}) AND NULLIF(TRIM(email), '') IS NOT NULL`
    : await sql`SELECT id, name, email FROM businesses WHERE id = ANY(${ids}) AND NULLIF(TRIM(email), '') IS NOT NULL`;
  if (recipients.length !== ids.length) {
    return NextResponse.json({ error: "One or more selected recipients no longer have a valid email address. Refresh the recipient list and try again." }, { status: 409 });
  }

  let sent = 0;
  const failed: Array<{ id: number; email: string }> = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < recipients.length) {
      const recipient = recipients[cursor++];
      const delivered = await sendAdminMessageEmail(String(recipient.email), subject, message);
      if (delivered) sent += 1;
      else failed.push({ id: Number(recipient.id), email: String(recipient.email) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, recipients.length) }, () => worker()));

  await logAdminAction({
    action: "email.bulk_send",
    entityType: "account_email",
    after: { audience, subject, selected: recipients.length, sent, failed: failed.length },
  }, await getAdminContext());

  return NextResponse.json({ ok: failed.length === 0, sent, failed, selected: recipients.length });
}
