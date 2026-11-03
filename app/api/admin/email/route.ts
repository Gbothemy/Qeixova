import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";
import { isEmailDeliveryConfigured, sendAdminMessageEmail } from "@/lib/email";
import { canonicalizeInterests, interestMatches } from "@/lib/interestTaxonomy";

const MAX_RECIPIENTS_PER_SEND = 1000;

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
  try {
  const rankId = Number(searchParams.get("rankId"));
  const rankFilter = Number.isSafeInteger(rankId) && rankId > 0;
  const recipients = audience === "contributors"
    ? await sql`
        SELECT users.id, full_name AS name, email, interests
          , l.id AS rank_id, l.level_number, l.name AS rank_name
        FROM users
        LEFT JOIN levels l ON l.id = users.level_id
        WHERE NULLIF(TRIM(email), '') IS NOT NULL
          AND (${search} = '' OR full_name ILIKE ${pattern} OR email ILIKE ${pattern})
          AND (${rankFilter} = FALSE OR l.id = ${rankId})
        ORDER BY full_name, users.id
      `
    : await sql`
        SELECT businesses.id, name, email
        FROM businesses
        WHERE NULLIF(TRIM(email), '') IS NOT NULL
          AND (${search} = '' OR name ILIKE ${pattern} OR email ILIKE ${pattern})
        ORDER BY name, businesses.id
      `;

  const missionId = Number(searchParams.get("missionId"));
  let mission: { id: number; title: string; target_interests: string[] } | null = null;
  let matchedIds: number[] = [];
  if (audience === "contributors") {
    const missions = await sql`
      SELECT id, title, COALESCE(target_interests, '{}') AS target_interests
      FROM tasks WHERE is_active = TRUE ORDER BY title, id
    `;
    const ranks = await sql`SELECT id, level_number, name, min_qlt FROM levels ORDER BY level_number, id`;
    const availableMissions = missions.map((row) => ({
      id: Number(row.id), title: String(row.title), target_interests: canonicalizeInterests(row.target_interests),
    }));
    mission = availableMissions.find((item) => item.id === missionId) ?? null;
    if (mission) {
      matchedIds = recipients
        .filter((row) => interestMatches(mission!.target_interests, canonicalizeInterests(row.interests)))
        .map((row) => Number(row.id));
    }
    return NextResponse.json({ recipients: recipients.map(({ interests: _interests, ...recipient }) => recipient), missions: availableMissions, ranks, mission, matchedIds, limit: MAX_RECIPIENTS_PER_SEND, deliveryConfigured: isEmailDeliveryConfigured() });
  }

  return NextResponse.json({ recipients, missions: [], ranks: [], mission: null, matchedIds: [], limit: MAX_RECIPIENTS_PER_SEND, deliveryConfigured: isEmailDeliveryConfigured() });
  } catch (error) {
    console.error("[admin/email] Failed to load recipients", error);
    return NextResponse.json({ error: "Could not load recipients. Check the database connection and try again." }, { status: 503 });
  }
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
