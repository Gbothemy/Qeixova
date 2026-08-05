import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { openCampaignDispute } from "@/lib/universalCampaignEngine";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignSubmissionId = Number(body.campaignSubmissionId);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!Number.isFinite(campaignSubmissionId) || campaignSubmissionId <= 0 || !reason) {
    return NextResponse.json({ error: "campaignSubmissionId and reason are required" }, { status: 400 });
  }

  const result = await openCampaignDispute({ campaignSubmissionId, openedByUserId: session.userId, reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result);
}
