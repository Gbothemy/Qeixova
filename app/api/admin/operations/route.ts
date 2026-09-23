import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { canAdmin, ensureAdminPlatformTables, getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { ensureUniversalCampaignTables, resolveCampaignDispute } from "@/lib/universalCampaignEngine";
import bcrypt from "bcryptjs";

async function authorize(permission = "dashboard.read") {
  const actor = await getAdminContext();
  return actor && canAdmin(actor, permission) ? actor : null;
}

export async function GET(req: NextRequest) {
  const actor = await authorize();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureAdminPlatformTables();
  const section = req.nextUrl.searchParams.get("section") ?? "overview";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sectionPermissions:Record<string,string>={overview:"dashboard.read",search:"accounts.read",risk:"risk.read",disputes:"disputes.read",analytics:"analytics.read",health:"dashboard.read",notes:"notes.read",support:"support.read",privacy:"privacy.read",team:"admin.manage",bulk:"accounts.manage",controls:"platform.manage",backups:"backup.manage",exports:"exports.read"};
  const required=sectionPermissions[section];
  if(!required) return NextResponse.json({error:"Unknown section"},{status:400});
  if(!canAdmin(actor,required)) return NextResponse.json({error:"This section is not available for your access level."},{status:403});

  if (section === "overview") {
    await ensureUniversalCampaignTables();
    await sql`INSERT INTO admin_notifications(severity,category,title,message,href)
      SELECT 'warning','payouts','Payout queue requires attention',COUNT(*)::text||' withdrawal requests are pending.','/admin/withdrawals'
      FROM transactions WHERE type='debit' AND status IN ('pending','processing')
      HAVING COUNT(*)>0 AND NOT EXISTS(SELECT 1 FROM admin_notifications WHERE category='payouts' AND read_at IS NULL AND created_at>NOW()-INTERVAL '6 hours')`;
    const [alerts, events, pendingDisputes, pendingPayouts] = await Promise.all([
      sql`SELECT * FROM admin_notifications ORDER BY (read_at IS NULL) DESC, created_at DESC LIMIT 30`,
      sql`SELECT * FROM admin_events ORDER BY created_at DESC LIMIT 30`,
      sql`SELECT COUNT(*)::int count FROM campaign_disputes WHERE status='open'`,
      sql`SELECT COUNT(*)::int count FROM transactions WHERE type='debit' AND status IN ('pending','processing')`,
    ]);
    return NextResponse.json({ actor, alerts, events, counts: { disputes: pendingDisputes[0]?.count ?? 0, payouts: pendingPayouts[0]?.count ?? 0 } });
  }

  if(section==="team"){
    const [admins,sessions,loginHistory]=await Promise.all([
      sql`SELECT id,email,name,role,active,two_factor_enabled,created_at,last_login_at FROM admin_users ORDER BY created_at DESC`,
      sql`SELECT s.id,s.admin_id,s.ip_address,s.user_agent,s.created_at,s.last_seen_at,s.expires_at,s.revoked_at,a.name,a.email FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_id ORDER BY s.created_at DESC LIMIT 50`,
      sql`SELECT h.*,a.name FROM admin_login_history h LEFT JOIN admin_users a ON a.id=h.admin_id ORDER BY h.created_at DESC LIMIT 50`,
    ]);
    return NextResponse.json({actor,admins,sessions,loginHistory});
  }
  if(section==="privacy") return NextResponse.json({actor,privacy:await sql`SELECT * FROM privacy_requests ORDER BY requested_at DESC LIMIT 30`});
  if(section==="controls") return NextResponse.json({actor,settings:await sql`SELECT key,value,updated_at FROM platform_settings ORDER BY key`});
  if(["bulk","backups","exports"].includes(section)) return NextResponse.json({actor});

  if (section === "search") {
    if (q.length < 2) return NextResponse.json({ results: [] });
    const pattern = `%${q}%`;
    const [users, businesses, campaigns, withdrawals] = await Promise.all([
      sql`SELECT id,full_name AS title,email AS subtitle,'user' AS type FROM users WHERE full_name ILIKE ${pattern} OR email ILIKE ${pattern} ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT id,name AS title,email AS subtitle,'business' AS type FROM businesses WHERE name ILIKE ${pattern} OR email ILIKE ${pattern} ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT id,title,COALESCE(campaign_status,'draft') AS subtitle,'campaign' AS type FROM tasks WHERE title ILIKE ${pattern} ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT t.id,COALESCE(u.full_name,u.email) AS title,t.status AS subtitle,'withdrawal' AS type FROM transactions t JOIN users u ON u.id=t.user_id WHERE t.type='debit' AND (u.full_name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR t.label ILIKE ${pattern}) ORDER BY t.created_at DESC LIMIT 8`,
    ]);
    return NextResponse.json({ results: [...users, ...businesses, ...campaigns, ...withdrawals] });
  }

  if (section === "risk") {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 100`;
    const [users, events] = await Promise.all([
      sql`SELECT u.id,u.full_name,u.email,u.trust_score,(NOT COALESCE(u.banned,FALSE)) AS is_active,COUNT(c.id)::int AS submissions,
        COUNT(c.id) FILTER (WHERE c.status='rejected')::int AS rejected
        FROM users u LEFT JOIN completions c ON c.user_id=u.id
        GROUP BY u.id HAVING u.trust_score<60 OR COUNT(c.id) FILTER (WHERE c.status='rejected')>=3
        ORDER BY u.trust_score ASC, rejected DESC LIMIT 100`,
      sql`SELECT * FROM audit_logs WHERE event_type IN ('fraud_flagged','rate_limit_hit','trust_score_updated') ORDER BY created_at DESC LIMIT 100`,
    ]);
    return NextResponse.json({ users, events });
  }

  if (section === "disputes") {
    await ensureUniversalCampaignTables();
    const disputes = await sql`SELECT d.*,t.title AS campaign_title,u.full_name AS contributor_name,u.email AS contributor_email
      FROM campaign_disputes d LEFT JOIN tasks t ON t.id=d.campaign_id LEFT JOIN users u ON u.id=d.opened_by_user_id
      ORDER BY CASE WHEN d.status='open' THEN 0 ELSE 1 END,d.created_at DESC LIMIT 100`;
    return NextResponse.json({ disputes });
  }

  if (section === "analytics") {
    const [dailyUsers, dailyProofs, dailyPayouts, regions] = await Promise.all([
      sql`SELECT DATE(created_at)::text AS label,COUNT(*)::int AS value FROM users WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
      sql`SELECT DATE(completed_at)::text AS label,COUNT(*)::int AS value FROM completions WHERE completed_at>=NOW()-INTERVAL '30 days' GROUP BY DATE(completed_at) ORDER BY DATE(completed_at)`,
      sql`SELECT DATE(created_at)::text AS label,COALESCE(SUM(amount),0)::bigint AS value FROM transactions WHERE type='debit' AND created_at>=NOW()-INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
      sql`SELECT COALESCE(NULLIF(state,''),NULLIF(country,''),'Unknown') label,COUNT(*)::int value FROM users GROUP BY 1 ORDER BY value DESC LIMIT 10`,
    ]);
    return NextResponse.json({ dailyUsers, dailyProofs, dailyPayouts, regions });
  }

  if (section === "health") {
    const started = Date.now();
    let database = "healthy";
    try { await sql`SELECT 1`; } catch { database = "unavailable"; }
    const [expiredActive, stuckPayouts, oldPendingProofs, failedAlerts] = await Promise.all([
      sql`SELECT COUNT(*)::int count FROM tasks WHERE is_active=TRUE AND expires_at<NOW()`,
      sql`SELECT COUNT(*)::int count FROM transactions WHERE type='debit' AND status='processing' AND created_at<NOW()-INTERVAL '24 hours'`,
      sql`SELECT COUNT(*)::int count FROM completions WHERE status='pending' AND completed_at<NOW()-INTERVAL '24 hours'`,
      sql`SELECT COUNT(*)::int count FROM admin_notifications WHERE severity='critical' AND read_at IS NULL`,
    ]);
    return NextResponse.json({ checks: [
      { name: "Database", status: database, detail: `${Date.now()-started}ms response` },
      { name: "Expiry processor", status: Number(expiredActive[0].count) ? "warning" : "healthy", detail: `${expiredActive[0].count} expired missions still active` },
      { name: "Payout queue", status: Number(stuckPayouts[0].count) ? "warning" : "healthy", detail: `${stuckPayouts[0].count} processing over 24 hours` },
      { name: "Proof queue", status: Number(oldPendingProofs[0].count) ? "warning" : "healthy", detail: `${oldPendingProofs[0].count} pending over 24 hours` },
      { name: "Critical alerts", status: Number(failedAlerts[0].count) ? "critical" : "healthy", detail: `${failedAlerts[0].count} unread critical alerts` },
    ] });
  }

  if (section === "notes") {
    const notes = await sql`SELECT * FROM admin_notes ORDER BY created_at DESC LIMIT 100`;
    return NextResponse.json({ notes });
  }
  if(section==="support"){
    const cases=await sql`SELECT c.*,a.name AS assigned_admin FROM support_cases c LEFT JOIN admin_users a ON a.id=c.assigned_admin_id ORDER BY CASE c.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,CASE WHEN c.status='open' THEN 0 ELSE 1 END,c.updated_at DESC LIMIT 100`;
    const accountType=req.nextUrl.searchParams.get("accountType"),accountId=Number(req.nextUrl.searchParams.get("accountId"));
    let account:Record<string,unknown>|undefined;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 100`;
    if(accountType==="user"&&Number.isFinite(accountId)){const rows=await sql`SELECT u.id,u.full_name,u.email,u.country,u.state,u.city,u.balance,(NOT COALESCE(u.banned,FALSE)) AS is_active,u.trust_score,u.created_at,COUNT(c.id)::int submissions,COUNT(c.id) FILTER(WHERE c.status='approved')::int approved FROM users u LEFT JOIN completions c ON c.user_id=u.id WHERE u.id=${accountId} GROUP BY u.id`;account=rows[0] as Record<string,unknown>}
    if(accountType==="business"&&Number.isFinite(accountId)){const rows=await sql`SELECT b.id,b.name,b.email,b.country,b.state,b.city,b.balance,(COALESCE(b.status,'active')='active') AS is_active,b.created_at,COUNT(t.id)::int campaigns FROM businesses b LEFT JOIN tasks t ON t.business_id=b.id WHERE b.id=${accountId} GROUP BY b.id`;account=rows[0] as Record<string,unknown>}
    return NextResponse.json({cases,account});
  }
  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const actor = await authorize();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureAdminPlatformTables();
  const body = await req.json();
  const action = String(body.action ?? "");

  if (action === "mark_alert_read") {
    await sql`UPDATE admin_notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=${Number(body.id)}`;
  } else if (action === "add_note") {
    if (!canAdmin(actor,"notes.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const note = String(body.note ?? "").trim();
    if (!note || !body.entityType || !body.entityId) return NextResponse.json({ error: "Entity and note are required" }, { status: 400 });
    await sql`INSERT INTO admin_notes(entity_type,entity_id,note,tags,admin_id,admin_email) VALUES (${String(body.entityType)},${String(body.entityId)},${note},${Array.isArray(body.tags)?body.tags:[]},${actor.id},${actor.email})`;
  } else if (action === "resolve_dispute") {
    if (!canAdmin(actor,"disputes.manage") && actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await resolveCampaignDispute({ disputeId:Number(body.id), resolution:String(body.resolution) as "approve"|"reject"|"partial_reward"|"needs_correction", note:String(body.note??"") });
  } else if (action === "privacy_update") {
    if (!canAdmin(actor,"privacy.manage") && actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await sql`UPDATE privacy_requests SET status=${String(body.status)},notes=${String(body.notes??"")},completed_at=CASE WHEN ${String(body.status)}='completed' THEN NOW() ELSE NULL END WHERE id=${Number(body.id)}`;
  } else if (action === "privacy_create") {
    if (!canAdmin(actor,"privacy.manage") && actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if(!["user","business"].includes(body.accountType)||!["access","export","anonymize","delete"].includes(body.requestType)||!Number.isFinite(Number(body.accountId))) return NextResponse.json({error:"Valid account, ID, and request type are required"},{status:400});
    await sql`INSERT INTO privacy_requests(account_type,account_id,request_type,notes) VALUES (${String(body.accountType)},${Number(body.accountId)},${String(body.requestType)},${String(body.notes??"")})`;
  } else if (action === "save_retention") {
    if (actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const days = Math.max(30,Math.min(3650,Number(body.days)||365));
    await sql`INSERT INTO platform_settings(key,value,updated_by) VALUES ('data_retention_days',${JSON.stringify({days})},${actor.id}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`;
  } else if (action === "save_platform_controls") {
    if(actor.role!=="super_admin") return NextResponse.json({error:"Forbidden"},{status:403});
    const value={maintenanceMode:Boolean(body.maintenanceMode),featureFlags:body.featureFlags??{},reportSchedule:["off","daily","weekly","monthly"].includes(body.reportSchedule)?body.reportSchedule:"off",reportEmail:String(body.reportEmail??"")};
    await sql`INSERT INTO platform_settings(key,value,updated_by) VALUES ('platform_controls',${JSON.stringify(value)},${actor.id}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`;
  } else if(action==="support_create"){
    if(!canAdmin(actor,"notes.manage")&&actor.role!=="super_admin")return NextResponse.json({error:"Forbidden"},{status:403});
    if(!["user","business"].includes(body.accountType)||!Number.isFinite(Number(body.accountId))||!String(body.subject??"").trim())return NextResponse.json({error:"Account and subject are required"},{status:400});
    await sql`INSERT INTO support_cases(account_type,account_id,subject,description,priority,assigned_admin_id) VALUES (${String(body.accountType)},${Number(body.accountId)},${String(body.subject)},${String(body.description??"")},${String(body.priority??"normal")},${actor.id})`;
  } else if(action==="support_update"){
    if(!canAdmin(actor,"notes.manage")&&actor.role!=="super_admin")return NextResponse.json({error:"Forbidden"},{status:403});
    await sql`UPDATE support_cases SET status=${String(body.status)},resolution=${String(body.resolution??"")},assigned_admin_id=COALESCE(assigned_admin_id,${actor.id}),updated_at=NOW(),resolved_at=CASE WHEN ${String(body.status)}='resolved' THEN NOW() ELSE NULL END WHERE id=${Number(body.id)}`;
  } else if (action === "revoke_session") {
    if (actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await sql`UPDATE admin_sessions SET revoked_at=NOW() WHERE id=${Number(body.id)}`;
  } else if (action === "create_admin") {
    if (actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const email=String(body.email??"").trim().toLowerCase(), password=String(body.password??""), name=String(body.name??"").trim();
    const roles=["super_admin","operations","finance","reviewer","support","analyst"];
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||!name||!roles.includes(body.role)) return NextResponse.json({error:"Name, valid email, role, and a 12-character password are required"},{status:400});
    const hash=await bcrypt.hash(password,12);
    try{
      await sql`INSERT INTO admin_users(email,password,name,role) VALUES (${email},${hash},${name},${String(body.role)})`;
    }catch(error){
      const message=error instanceof Error?error.message:"";
      if(message.toLowerCase().includes("unique")||message.toLowerCase().includes("duplicate")) return NextResponse.json({error:"An administrator with this email already exists."},{status:409});
      console.error("[admin operations] create administrator failed",error);
      return NextResponse.json({error:"Unable to create the administrator right now. Please try again."},{status:500});
    }
  } else if (action === "update_admin") {
    if (actor.role!=="super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if(Number(body.id)===actor.id && body.active===false) return NextResponse.json({error:"You cannot deactivate your own account"},{status:400});
    await sql`UPDATE admin_users SET role=${String(body.role)},active=${Boolean(body.active)},two_factor_enabled=${Boolean(body.twoFactorEnabled)} WHERE id=${Number(body.id)}`;
  } else if(action==="reset_admin_password"){
    if(actor.role!=="super_admin")return NextResponse.json({error:"Forbidden"},{status:403});
    const password=String(body.password??"");if(password.length<12)return NextResponse.json({error:"Password must be at least 12 characters"},{status:400});
    await sql`UPDATE admin_users SET password=${await bcrypt.hash(password,12)} WHERE id=${Number(body.id)}`;
    await sql`UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_id=${Number(body.id)}`;
  } else if (action === "bulk_update") {
    if(!canAdmin(actor,"accounts.manage")&&actor.role!=="super_admin") return NextResponse.json({error:"Forbidden"},{status:403});
    const ids=Array.isArray(body.ids)?body.ids.map(Number).filter(Number.isFinite).slice(0,100):[];
    if(!ids.length||!String(body.reason??"").trim()) return NextResponse.json({error:"Record IDs and a reason are required"},{status:400});
    if(body.target==="users"&&["activate","suspend"].includes(body.operation)) await sql`UPDATE users SET banned=${body.operation!=="activate"} WHERE id=ANY(${ids})`;
    else if(body.target==="businesses"&&["activate","suspend"].includes(body.operation)) await sql`UPDATE businesses SET status=${body.operation==="activate"?"active":"suspended"} WHERE id=ANY(${ids})`;
    else if(body.target==="campaigns"&&["pause","activate"].includes(body.operation)) await sql`UPDATE tasks SET is_active=${body.operation==="activate"},campaign_status=${body.operation==="activate"?"live":"paused"} WHERE id=ANY(${ids})`;
    else return NextResponse.json({error:"Unsupported bulk operation"},{status:400});
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  await logAdminAction({ action, entityType: body.entityType, entityId: body.entityId ?? body.id, after: body, reason: body.reason ?? body.note }, actor);
  return NextResponse.json({ ok: true });
}
