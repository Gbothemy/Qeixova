import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { ensureBusinessSecurityTables } from "@/lib/businessSecurity";

export async function GET() {
  try {
    const session = await getBusinessSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureBusinessSecurityTables();
    const [business, sessions, history] = await Promise.all([
      sql`SELECT two_factor_enabled FROM businesses WHERE id = ${session.businessId}`,
      sql`SELECT id,ip_address,user_agent,created_at,last_seen_at FROM business_sessions WHERE business_id = ${session.businessId} AND revoked_at IS NULL ORDER BY last_seen_at DESC`,
      sql`SELECT id,success,ip_address,user_agent,created_at FROM business_login_history WHERE business_id = ${session.businessId} ORDER BY created_at DESC LIMIT 20`,
    ]);

    return NextResponse.json({
      twoFactorEnabled: Boolean(business[0]?.two_factor_enabled),
      currentSessionId: session.sessionId,
      sessions,
      history,
    });
  } catch (error) {
    console.error("Could not load business security settings", error);
    return NextResponse.json({ error: "Security settings are temporarily unavailable. Please try again." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getBusinessSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureBusinessSecurityTables();
    const payload: unknown = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const body = payload as Record<string, unknown>;

    if (body.action === "password") {
      if (String(body.newPassword || "").length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }
      const rows = await sql`SELECT password FROM businesses WHERE id = ${session.businessId}`;
      if (!rows[0] || !await bcrypt.compare(String(body.currentPassword || ""), rows[0].password)) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }
      await sql`UPDATE businesses SET password = ${await bcrypt.hash(String(body.newPassword), 10)} WHERE id = ${session.businessId}`;
      await sql`UPDATE business_sessions SET revoked_at = NOW() WHERE business_id = ${session.businessId} AND id <> ${session.sessionId || ""}`;
      return NextResponse.json({ ok: true, message: "Password changed. Other sessions were signed out." });
    }

    if (body.action === "two_factor") {
      await sql`UPDATE businesses SET two_factor_enabled = ${Boolean(body.enabled)} WHERE id = ${session.businessId}`;
      return NextResponse.json({ ok: true, message: body.enabled ? "Two-step verification enabled." : "Two-step verification disabled." });
    }

    if (body.action === "revoke" && typeof body.sessionId === "string") {
      await sql`UPDATE business_sessions SET revoked_at = NOW() WHERE business_id = ${session.businessId} AND id = ${body.sessionId} AND id <> ${session.sessionId || ""}`;
      return NextResponse.json({ ok: true, message: "Session signed out." });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Could not update business security settings", error);
    return NextResponse.json({ error: "Security settings could not be updated. Please try again." }, { status: 503 });
  }
}
