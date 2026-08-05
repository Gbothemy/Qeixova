import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { canonicalizeInterests } from "@/lib/interestTaxonomy";

async function ensureBusinessOnboardingColumns() {
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb`;
}

export async function POST(req: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    industry,
    description,
    website,
    campaignGoals,
    campaignCategories,
    preferredPlatforms,
    targetInterests,
    country,
    state,
    city,
    alertPreferences,
  } = body;

  await ensureBusinessOnboardingColumns();

  const profile = {
    description: typeof description === "string" ? description.trim() : "",
    campaignGoals: Array.isArray(campaignGoals) ? campaignGoals : [],
    campaignCategories: Array.isArray(campaignCategories) ? campaignCategories : [],
    preferredPlatforms: Array.isArray(preferredPlatforms) ? preferredPlatforms : [],
    targetInterests: canonicalizeInterests(targetInterests),
    location: {
      country: typeof country === "string" ? country.trim() : "Nigeria",
      state: typeof state === "string" ? state.trim() : "",
      city: typeof city === "string" ? city.trim() : "",
    },
    alertPreferences: Array.isArray(alertPreferences) ? alertPreferences : [],
    onboardingVersion: "business-campaign-v2",
  };

  await sql`
    UPDATE businesses
    SET industry = ${typeof industry === "string" && industry.trim() ? industry.trim() : null},
        website = ${typeof website === "string" && website.trim() ? website.trim() : null},
        profile = ${JSON.stringify(profile)}::jsonb,
        onboarding_completed = TRUE
    WHERE id = ${session.businessId}
  `;

  await createBusinessNotification({
    businessId: session.businessId,
    type: "system",
    tone: "gold",
    title: "Business onboarding completed",
    body: "Your business workspace is ready. You can now create campaigns, fund your wallet, and receive alert details without leaving the Alerts page.",
    status: "Unread",
    href: "/business/tasks/new",
    metadata: {
      campaignGoals: profile.campaignGoals,
      campaignCategories: profile.campaignCategories,
      preferredPlatforms: profile.preferredPlatforms,
      targetLocation: profile.location,
    },
  });

  return NextResponse.json({ ok: true });
}
