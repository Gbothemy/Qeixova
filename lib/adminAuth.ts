import { cookies } from "next/headers";
import { createHash } from "crypto";
import { sql } from "@/lib/db";
import { normalizeAdminRole, roleCan } from "@/lib/adminRoles";

const DEV_ADMIN_TOKEN = "qeixova-dev-admin-token";

export function getAdminToken() {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
  if (process.env.NODE_ENV !== "production") return DEV_ADMIN_TOKEN;
  throw new Error("ADMIN_SECRET environment variable is required in production");
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (token === getAdminToken()) return true;
  const session = cookieStore.get("admin_session")?.value;
  if (!session) return false;
  try {
    const rows = await sql`SELECT 1 FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_id
      WHERE s.token_hash=${createHash("sha256").update(session).digest("hex")} AND s.revoked_at IS NULL AND s.expires_at>NOW() AND a.active=TRUE LIMIT 1`;
    return rows.length > 0;
  } catch { return false; }
}

export function checkAdminHeader(req: Request): boolean {
  const key = req.headers.get("x-admin-key");
  return Boolean(key) && key === getAdminToken();
}

export async function checkAdminAuth(req: Request, permission?:string): Promise<boolean> {
  if (checkAdminHeader(req)) return true;
  const cookieStore=await cookies();
  if(cookieStore.get("admin_token")?.value===getAdminToken())return true;
  const session=cookieStore.get("admin_session")?.value;if(!session)return false;
  try{const rows=await sql`SELECT a.role FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_id WHERE s.token_hash=${createHash("sha256").update(session).digest("hex")} AND s.revoked_at IS NULL AND s.expires_at>NOW() AND a.active=TRUE LIMIT 1`;if(!rows[0])return false;if(!permission)return true;return roleCan(normalizeAdminRole(rows[0].role),permission)}catch{return false}
}
