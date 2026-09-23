import { NextRequest, NextResponse } from "next/server";
import { getAdminToken } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createAdminSession, ensureAdminPlatformTables } from "@/lib/adminPlatform";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { sendAdminSecurityCodeEmail } from "@/lib/email";

function getAdminCredentials() {
  const isProd = process.env.NODE_ENV === "production";
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  return {
    email: process.env.ADMIN_EMAIL ?? (isProd ? "admin@qeixova.com" : "admin@qeixova.com"),
    password: process.env.ADMIN_PASSWORD ?? (isProd ? adminSecret : "Qeixova@Admin2025"),
  };
}

function matchesDevelopmentAdmin(email: string, password: string) {
  return process.env.NODE_ENV !== "production"
    && email === "admin@qeixova.com"
    && password === "Qeixovaadmin";
}

async function ensureAdminUsersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Platform Admin',
      role TEXT NOT NULL DEFAULT 'admin',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP
    )
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, challengeId, code } = await req.json();
    const admin = getAdminCredentials();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPassword = String(password ?? "");

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const requestHeaders = await headers();
    const ip=requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
    try{
      await ensureAdminUsersTable();await ensureAdminPlatformTables();
      const blocked=await sql`SELECT COUNT(*)::int count FROM admin_login_history WHERE email=${normalizedEmail} AND success=FALSE AND created_at>NOW()-INTERVAL '15 minutes'`;
      if(Number(blocked[0]?.count)>=5) return NextResponse.json({error:"Too many failed attempts. Try again in 15 minutes."},{status:429});
    }catch{/* configured fallback may still authenticate during database incidents */}

    const matchesConfiguredAdmin = admin.email
      && admin.password
      && normalizedEmail === admin.email.toLowerCase()
      && normalizedPassword === admin.password;

    if (matchesConfiguredAdmin || matchesDevelopmentAdmin(normalizedEmail, normalizedPassword)) {
      try{
        await ensureAdminUsersTable();await ensureAdminPlatformTables();
        const hash=await bcrypt.hash(normalizedPassword,12);
        const rows=await sql`INSERT INTO admin_users(email,password,name,role,active,last_login_at) VALUES (${normalizedEmail},${hash},'Platform Admin','super_admin',TRUE,NOW()) ON CONFLICT(email) DO UPDATE SET password=EXCLUDED.password,role='super_admin',active=TRUE,last_login_at=NOW() RETURNING id`;
        const session=await createAdminSession(Number(rows[0].id));
        await sql`INSERT INTO admin_login_history(admin_id,email,success,ip_address,user_agent) VALUES (${rows[0].id},${normalizedEmail},TRUE,${ip},${requestHeaders.get("user-agent")})`;
        const res = NextResponse.json({ ok: true });
        res.cookies.set("admin_session", session.token, {
          httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60*60*8, path: "/",
        });
        res.cookies.set("admin_token","",{maxAge:0,path:"/"});
        return res;
      }catch(error){
        console.error("[api/admin/login] configured admin session failed",error);
        if(process.env.NODE_ENV==="production") return NextResponse.json({error:"Unable to establish a secure admin session"},{status:503});
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.set("admin_token", getAdminToken(), {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 8,
        path: "/",
      });
      return res;
    }

    try {
      await ensureAdminUsersTable();
      await ensureAdminPlatformTables();
      const rows = await sql`
        SELECT id, password, email, name, role, two_factor_enabled
        FROM admin_users
        WHERE lower(email) = ${normalizedEmail} AND active = TRUE
        LIMIT 1
      `;

      if (rows[0] && await bcrypt.compare(normalizedPassword, rows[0].password)) {
        if(rows[0].two_factor_enabled){
          if(!challengeId||!code){
            const otp=String(Math.floor(100000+Math.random()*900000)),id=randomBytes(24).toString("hex"),hash=await bcrypt.hash(otp,10);
            await sql`INSERT INTO admin_two_factor_challenges(id,admin_id,code_hash,expires_at) VALUES (${id},${rows[0].id},${hash},NOW()+INTERVAL '10 minutes')`;
            const sent=await sendAdminSecurityCodeEmail(String(rows[0].email),String(rows[0].name),otp);
            if(!sent&&process.env.NODE_ENV==="production") return NextResponse.json({error:"Unable to send the security code"},{status:503});
            return NextResponse.json({requiresTwoFactor:true,challengeId:id,developmentCode:process.env.NODE_ENV!=="production"?otp:undefined});
          }
          const challenges=await sql`SELECT id,code_hash,attempt_count FROM admin_two_factor_challenges WHERE id=${String(challengeId)} AND admin_id=${rows[0].id} AND consumed_at IS NULL AND expires_at>NOW() LIMIT 1`;
          if(!challenges[0]||challenges[0].attempt_count>=5||!await bcrypt.compare(String(code),String(challenges[0]?.code_hash??""))){
            if(challenges[0])await sql`UPDATE admin_two_factor_challenges SET attempt_count=attempt_count+1 WHERE id=${String(challengeId)}`;
            return NextResponse.json({error:"Invalid or expired security code",requiresTwoFactor:true,challengeId},{status:401});
          }
          await sql`UPDATE admin_two_factor_challenges SET consumed_at=NOW() WHERE id=${String(challengeId)}`;
        }
        await sql`UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].id}`;
        const session = await createAdminSession(Number(rows[0].id));
        await sql`INSERT INTO admin_login_history (admin_id,email,success,ip_address,user_agent) VALUES (${rows[0].id},${normalizedEmail},TRUE,${requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null},${requestHeaders.get("user-agent")})`;
        const res = NextResponse.json({ ok: true });
        res.cookies.set("admin_session", session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 8,
          path: "/",
        });
        return res;
      }
      await sql`INSERT INTO admin_login_history (email,success,ip_address,user_agent) VALUES (${normalizedEmail},FALSE,${requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null},${requestHeaders.get("user-agent")})`;
    } catch (error) {
      console.error("[api/admin/login] database lookup failed", error);
    }

    if (!admin.email || !admin.password) {
      return NextResponse.json({ error: "Admin login is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (error) {
    console.error("[api/admin/login] request failed", error);
    return NextResponse.json({ error: "Unable to sign in right now" }, { status: 500 });
  }
}
