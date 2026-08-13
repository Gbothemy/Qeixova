import { NextRequest, NextResponse } from "next/server";
import { getAdminToken } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

function getAdminCredentials() {
  const isProd = process.env.NODE_ENV === "production";
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  return {
    email: process.env.ADMIN_EMAIL ?? (isProd ? "admin@qeixova.com" : "admin@qeixova.com"),
    password: process.env.ADMIN_PASSWORD ?? (isProd ? adminSecret : "Qeixova@Admin2025"),
  };
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
  const { email, password } = await req.json();
  const admin = getAdminCredentials();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  await ensureAdminUsersTable();
  const rows = await sql`
    SELECT id, password
    FROM admin_users
    WHERE lower(email) = ${normalizedEmail} AND active = TRUE
    LIMIT 1
  `;

  if (rows[0] && await bcrypt.compare(password, rows[0].password)) {
    await sql`UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].id}`;
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_token", getAdminToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return res;
  }

  if (!admin.email || !admin.password) {
    return NextResponse.json({ error: "Admin login is not configured" }, { status: 503 });
  }
  if (normalizedEmail === admin.email.toLowerCase() && password === admin.password) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_token", getAdminToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });
    return res;
  }
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
