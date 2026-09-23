import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { sql } from "@/lib/db";
import { checkAdminHeader, getAdminToken } from "@/lib/adminAuth";
import { AdminRole, normalizeAdminRole, roleCan } from "@/lib/adminRoles";

export type { AdminRole } from "@/lib/adminRoles";
export type AdminContext = { id: number | null; email: string; name: string; role: AdminRole; sessionId: number | null };

let platformSetupPromise:Promise<void>|null=null;

async function setupAdminPlatformTables() {
  await sql`CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Platform Admin', role TEXT NOT NULL DEFAULT 'admin',
    active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), last_login_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_sessions (
    id BIGSERIAL PRIMARY KEY, admin_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL, ip_address TEXT, user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_login_history (
    id BIGSERIAL PRIMARY KEY, admin_id INTEGER, email TEXT NOT NULL, success BOOLEAN NOT NULL,
    ip_address TEXT, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS admin_two_factor_challenges (
    id TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_events (
    id BIGSERIAL PRIMARY KEY, admin_id INTEGER, admin_email TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, before_data JSONB,
    after_data JSONB, reason TEXT, ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_notifications (
    id BIGSERIAL PRIMARY KEY, severity TEXT NOT NULL DEFAULT 'info', category TEXT NOT NULL DEFAULT 'operations',
    title TEXT NOT NULL, message TEXT NOT NULL, href TEXT, read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_notes (
    id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, note TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}', admin_id INTEGER, admin_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_config_history (
    id BIGSERIAL PRIMARY KEY, config_key TEXT NOT NULL, old_value TEXT, new_value TEXT NOT NULL,
    reason TEXT NOT NULL, admin_id INTEGER, admin_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_action_approvals (
    id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_by INTEGER, approved_by INTEGER, status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS payout_reconciliation (
    id BIGSERIAL PRIMARY KEY, transaction_id INTEGER UNIQUE NOT NULL, provider_reference TEXT,
    recipient_verified BOOLEAN NOT NULL DEFAULT FALSE, reconciliation_status TEXT NOT NULL DEFAULT 'unverified',
    finance_note TEXT, first_approved_by INTEGER, second_approved_by INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS privacy_requests (
    id BIGSERIAL PRIMARY KEY, account_type TEXT NOT NULL, account_id INTEGER NOT NULL,
    request_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS support_cases (
    id BIGSERIAL PRIMARY KEY, account_type TEXT NOT NULL, account_id INTEGER NOT NULL,
    subject TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'open', assigned_admin_id INTEGER, resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_report_runs (
    id BIGSERIAL PRIMARY KEY, schedule TEXT NOT NULL, recipient TEXT NOT NULL, status TEXT NOT NULL,
    summary JSONB, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS admin_backups (
    id BIGSERIAL PRIMARY KEY, label TEXT NOT NULL, data JSONB NOT NULL,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_by INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_events_created ON admin_events(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notes_entity ON admin_notes(entity_type, entity_id)`;
}

export async function ensureAdminPlatformTables(){
  platformSetupPromise??=setupAdminPlatformTables();
  try{await platformSetupPromise}catch(error){platformSetupPromise=null;throw error}
}

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function createAdminSession(adminId: number) {
  await ensureAdminPlatformTables();
  const token = randomBytes(32).toString("hex");
  const headerStore = await headers();
  const rows = await sql`INSERT INTO admin_sessions (admin_id, token_hash, ip_address, user_agent, expires_at)
    VALUES (${adminId}, ${hashToken(token)}, ${headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null}, ${headerStore.get("user-agent")}, NOW() + INTERVAL '8 hours') RETURNING id`;
  return { token, sessionId: Number(rows[0].id) };
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  if (sessionToken) {
    try {
      await ensureAdminPlatformTables();
      const rows = await sql`SELECT s.id AS session_id, a.id, a.email, a.name, a.role
        FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_id
        WHERE s.token_hash=${hashToken(sessionToken)} AND s.revoked_at IS NULL AND s.expires_at > NOW() AND a.active=TRUE LIMIT 1`;
      if (rows[0]) {
        await sql`UPDATE admin_sessions SET last_seen_at=NOW() WHERE id=${rows[0].session_id}`;
        return { id: Number(rows[0].id), email: String(rows[0].email), name: String(rows[0].name), role: normalizeAdminRole(rows[0].role), sessionId: Number(rows[0].session_id) };
      }
    } catch { /* legacy auth remains available during database outages */ }
  }
  if (cookieStore.get("admin_token")?.value === getAdminToken()) {
    return { id: null, email: process.env.ADMIN_EMAIL ?? "platform-admin", name: "Platform Admin", role: "super_admin", sessionId: null };
  }
  return null;
}

export function canAdmin(context: AdminContext, permission: string) {
  return roleCan(context.role, permission);
}

export async function requireAdminPermission(req:Request,permission:string){
  if(checkAdminHeader(req)) return { id:null,email:"api-admin",name:"API Admin",role:"super_admin" as AdminRole,sessionId:null };
  const context=await getAdminContext();
  return context&&canAdmin(context,permission)?context:null;
}

export async function logAdminAction(input: {
  action: string; entityType?: string; entityId?: string | number; before?: unknown; after?: unknown; reason?: string;
}, context?: AdminContext | null) {
  try {
    await ensureAdminPlatformTables();
    const actor = context ?? await getAdminContext();
    const headerStore = await headers();
    await sql`INSERT INTO admin_events (admin_id, admin_email, action, entity_type, entity_id, before_data, after_data, reason, ip_address)
      VALUES (${actor?.id ?? null}, ${actor?.email ?? "system"}, ${input.action}, ${input.entityType ?? null}, ${input.entityId == null ? null : String(input.entityId)},
      ${input.before == null ? null : JSON.stringify(input.before)}, ${input.after == null ? null : JSON.stringify(input.after)}, ${input.reason ?? null},
      ${headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null})`;
  } catch (error) { console.error("[admin audit]", error); }
}

export async function createAdminAlert(severity: string, category: string, title: string, message: string, href?: string) {
  try {
    await ensureAdminPlatformTables();
    await sql`INSERT INTO admin_notifications (severity, category, title, message, href) VALUES (${severity}, ${category}, ${title}, ${message}, ${href ?? null})`;
  } catch (error) { console.error("[admin alert]", error); }
}

export async function platformFeatureEnabled(feature: "campaignCreation"|"withdrawals"|"community") {
  try {
    await ensureAdminPlatformTables();
    const rows=await sql`SELECT value FROM platform_settings WHERE key='platform_controls'`;
    if(!rows[0]) return true;
    const value=rows[0].value as {maintenanceMode?:boolean;featureFlags?:Record<string,boolean>};
    return !value.maintenanceMode && value.featureFlags?.[feature]!==false;
  } catch { return true; }
}

export async function createSafetySnapshot(label:string,adminId:number|null){
  await ensureAdminPlatformTables();
  const [users,businesses,tasks,completions,transactions,config]=await Promise.all([sql`SELECT * FROM users`,sql`SELECT * FROM businesses`,sql`SELECT * FROM tasks`,sql`SELECT * FROM completions`,sql`SELECT * FROM transactions`,sql`SELECT * FROM system_config`]);
  const data={version:1,createdAt:new Date().toISOString(),tables:{users,businesses,tasks,completions,transactions,system_config:config}};
  const rows=await sql`INSERT INTO admin_backups(label,data,created_by) VALUES (${label},${JSON.stringify(data)},${adminId}) RETURNING id`;
  return Number(rows[0].id);
}
