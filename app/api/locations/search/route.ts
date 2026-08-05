import { NextRequest, NextResponse } from "next/server";
import { searchLocations } from "@/lib/locationSearch";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 8));

  return NextResponse.json({ locations: searchLocations(query, limit) });
}
