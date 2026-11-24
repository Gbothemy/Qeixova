import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureMessagingSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureMessagingSchema();
    await sql`
      INSERT INTO contributor_presence (user_id, last_seen_at)
      VALUES (${session.userId}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW()
    `;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Contributor presence update failed:", error);
    return NextResponse.json({ error: "Presence could not update." }, { status: 503 });
  }
}
