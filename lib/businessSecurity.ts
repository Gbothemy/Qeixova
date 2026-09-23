import crypto from "crypto";
import { sql } from "@/lib/db";
export async function ensureBusinessSecurityTables(){
 await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
 await sql`CREATE TABLE IF NOT EXISTS business_sessions(id TEXT PRIMARY KEY,business_id INTEGER NOT NULL,ip_address TEXT,user_agent TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),last_seen_at TIMESTAMPTZ DEFAULT NOW(),revoked_at TIMESTAMPTZ)`;
 await sql`CREATE TABLE IF NOT EXISTS business_login_history(id BIGSERIAL PRIMARY KEY,business_id INTEGER,email TEXT NOT NULL,success BOOLEAN NOT NULL,ip_address TEXT,user_agent TEXT,created_at TIMESTAMPTZ DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS business_two_factor_codes(id BIGSERIAL PRIMARY KEY,business_id INTEGER NOT NULL,code_hash TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())`;
}
export const newSessionId=()=>crypto.randomBytes(24).toString('hex');
export const hashCode=(code:string)=>crypto.createHash('sha256').update(code).digest('hex');
