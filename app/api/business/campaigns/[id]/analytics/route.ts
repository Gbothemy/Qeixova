import { NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { getCampaignAnalytics } from "@/lib/universalCampaignEngine";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const ownerRows = await sql`SELECT id FROM campaigns WHERE id = ${campaignId} AND business_id = ${session.businessId}`;
  if (ownerRows.length === 0) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const analytics = await getCampaignAnalytics(campaignId);
  const platformBreakdown = await sql`
    SELECT platform, slots_allocated, slots_filled, reward_per_slot, verification_type
    FROM campaign_platforms
    WHERE campaign_id = ${campaignId}
    ORDER BY platform
  `;
  const financials = await sql`
    SELECT funded_amount, reserved_rewards, released_rewards, refunded_amount, platform_earned, available_balance
    FROM campaign_wallets
    WHERE campaign_id = ${campaignId}
    LIMIT 1
  `;

  return NextResponse.json({ analytics, platformBreakdown, financials: financials[0] ?? null });
}
