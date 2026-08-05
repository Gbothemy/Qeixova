import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { canonicalizeInterests } from "@/lib/interestTaxonomy";

async function ensureBusinessProfileColumns() {
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb`;
}

function cleanStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

export async function GET() {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBusinessProfileColumns();

  const rows = await sql`
    SELECT id, name, email, industry, website, balance, status, onboarding_completed, profile, created_at
    FROM businesses
    WHERE id = ${session.businessId}
  `;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ business: rows[0] });
}

export async function PATCH(req: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Business name must be at least 2 characters" }, { status: 400 });
  }

  await ensureBusinessProfileColumns();
  const existingRows = await sql`SELECT profile FROM businesses WHERE id = ${session.businessId}`;
  if (existingRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existingProfile = existingRows[0]?.profile && typeof existingRows[0].profile === "object" ? existingRows[0].profile : {};
  const profileInput = body.profile && typeof body.profile === "object" ? body.profile : {};
  const locationInput = profileInput.location && typeof profileInput.location === "object" ? profileInput.location : {};
  const nextProfile = {
    ...existingProfile,
    description: typeof profileInput.description === "string" ? profileInput.description.trim() : "",
    campaignGoals: cleanStringList(profileInput.campaignGoals),
    campaignCategories: cleanStringList(profileInput.campaignCategories),
    preferredPlatforms: cleanStringList(profileInput.preferredPlatforms),
    targetInterests: canonicalizeInterests(profileInput.targetInterests),
    location: {
      country: typeof locationInput.country === "string" && locationInput.country.trim() ? locationInput.country.trim() : "Nigeria",
      state: typeof locationInput.state === "string" ? locationInput.state.trim() : "",
      city: typeof locationInput.city === "string" ? locationInput.city.trim() : "",
    },
    alertPreferences: cleanStringList(profileInput.alertPreferences),
    updatedAt: new Date().toISOString(),
  };

  const rows = await sql`
    UPDATE businesses
    SET name = ${name},
        industry = ${typeof body.industry === "string" && body.industry.trim() ? body.industry.trim() : null},
        website = ${typeof body.website === "string" && body.website.trim() ? body.website.trim() : null},
        profile = ${JSON.stringify(nextProfile)}::jsonb
    WHERE id = ${session.businessId}
    RETURNING id, name, email, industry, website, balance, status, onboarding_completed, profile, created_at
  `;

  return NextResponse.json({ ok: true, business: rows[0] });
}
