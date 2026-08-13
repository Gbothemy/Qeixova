import { NextRequest, NextResponse } from "next/server";
import { searchLocations } from "@/lib/locationSearch";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";

function normalizeState(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+state$/i, "")
    .replace(/^federal capital territory$/i, "fct - abuja");

  if (["fct", "abuja", "fct - abuja"].includes(normalized)) return "fct - abuja";
  return normalized;
}

export async function GET(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 8));
  const locations = searchLocations(query, limit);

  if (locations.length === 0) return NextResponse.json({ locations });

  const contributorRows = await sql`
    SELECT state, country, COUNT(*)::int AS contributor_count
    FROM users
    WHERE COALESCE(onboarding_completed, FALSE) = TRUE
    GROUP BY state, country
  `;

  const countsByState = new Map<string, number>();
  const countsByCountry = new Map<string, number>();
  for (const row of contributorRows) {
    const count = Number(row.contributor_count ?? 0);
    const stateKey = normalizeState(row.state);
    const countryKey = String(row.country ?? "Nigeria").trim().toLowerCase();
    if (stateKey) countsByState.set(stateKey, (countsByState.get(stateKey) ?? 0) + count);
    if (countryKey) countsByCountry.set(countryKey, (countsByCountry.get(countryKey) ?? 0) + count);
  }

  return NextResponse.json({
    locations: locations.map((location) => {
      const state = location.type === "region" ? location.name : location.region;
      const contributorCount = state
        ? countsByState.get(normalizeState(state)) ?? 0
        : countsByCountry.get(location.country.trim().toLowerCase()) ?? 0;
      return { ...location, contributorCount };
    }),
  });
}
