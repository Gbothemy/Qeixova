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
    const { email, password } = await req.json();
    const admin = getAdminCredentials();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPassword = String(password ?? "");

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Environment credentials remain available when the database is temporarily offline.
    const matchesConfiguredAdmin = admin.email
      && admin.password
      && normalizedEmail === admin.email.toLowerCase()
      && normalizedPassword === admin.password;

    if (matchesConfiguredAdmin || matchesDevelopmentAdmin(normalizedEmail, normalizedPassword)) {
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

    try {
      await ensureAdminUsersTable();
      const rows = await sql`
        SELECT id, password
        FROM admin_users
        WHERE lower(email) = ${normalizedEmail} AND active = TRUE
        LIMIT 1
      `;

      if (rows[0] && await bcrypt.compare(normalizedPassword, rows[0].password)) {
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
