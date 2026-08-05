import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { resolveCampaignDispute } from "@/lib/universalCampaignEngine";

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disputes = await sql`
    SELECT d.*, c.title AS campaign_title, u.full_name AS opened_by_name
    FROM campaign_disputes d
    JOIN campaigns c ON c.id = d.campaign_id
    LEFT JOIN users u ON u.id = d.opened_by_user_id
    ORDER BY d.created_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ disputes });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const disputeId = Number(body.disputeId);
  const resolution = body.resolution;
  if (!Number.isFinite(disputeId) || !["approve", "reject", "partial_reward", "needs_correction"].includes(resolution)) {
    return NextResponse.json({ error: "Valid disputeId and resolution are required" }, { status: 400 });
  }

  const result = await resolveCampaignDispute({ disputeId, resolution, note: body.note });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result);
}
