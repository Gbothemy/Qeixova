import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { claimCampaignSlot } from "@/lib/universalCampaignEngine";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = Number(body.campaignId);
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const result = await claimCampaignSlot({ campaignId, contributorId: session.userId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const rows = await sql`
    SELECT c.business_id, c.task_id, c.title, u.full_name
    FROM campaigns c
    LEFT JOIN users u ON u.id = ${session.userId}
    WHERE c.id = ${campaignId}
  `;
  if (rows[0]?.business_id) {
    await createBusinessNotification({
      businessId: Number(rows[0].business_id),
      type: "participation",
      tone: "blue",
      title: "Contributor joined campaign",
      body: `${rows[0].full_name || "A contributor"} claimed a slot on ${rows[0].title}.`,
      status: "Claimed",
      href: `/business/tasks/${rows[0].task_id}`,
      metadata: { campaignId, taskId: rows[0].task_id, claimId: result.claimId, contributorId: session.userId },
    });
  }

  return NextResponse.json(result);
}
