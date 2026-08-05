import { sql } from "@/lib/db";

export function displayLevel(value: unknown) {
  const level = Number(value ?? 1);
  return Number.isFinite(level) ? Math.max(1, level) : 1;
}

export async function getStartingLevelId() {
  const preferred = await sql`SELECT id FROM levels WHERE level_number = 1 ORDER BY id ASC LIMIT 1`;
  if (preferred.length > 0) return Number(preferred[0].id);

  const fallback = await sql`SELECT id FROM levels ORDER BY level_number ASC, id ASC LIMIT 1`;
  return Number(fallback[0]?.id ?? 1);
}
