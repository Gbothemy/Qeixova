import { NextRequest } from "next/server";
import { canAdmin, getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "No records\n";
  const keys=Object.keys(rows[0]);
  const esc=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;
  return [keys.map(esc).join(","),...rows.map(row=>keys.map(key=>esc(row[key])).join(","))].join("\n");
}
export async function GET(req: NextRequest) {
  const actor=await getAdminContext();
  if(!actor||!canAdmin(actor,"exports.read")) return Response.json({error:"Unauthorized"},{status:401});
  const type=req.nextUrl.searchParams.get("type")??"users";
  let rows: Record<string,unknown>[];
  if(type==="users") rows=await sql`SELECT id,full_name,email,country,state,city,balance,(NOT COALESCE(banned,FALSE)) AS active,created_at FROM users ORDER BY created_at DESC` as Record<string,unknown>[];
  else if(type==="businesses") rows=await sql`SELECT id,name,email,country,state,city,balance,status,created_at FROM businesses ORDER BY created_at DESC` as Record<string,unknown>[];
  else if(type==="campaigns") rows=await sql`SELECT id,title,campaign_status,reward,total_budget,budget_used,approved_at,expires_at FROM tasks ORDER BY created_at DESC` as Record<string,unknown>[];
  else if(type==="withdrawals") rows=await sql`SELECT t.id,u.email,t.amount,t.status,t.label,t.created_at FROM transactions t JOIN users u ON u.id=t.user_id WHERE t.type='debit' ORDER BY t.created_at DESC` as Record<string,unknown>[];
  else if(type==="audit") rows=await sql`SELECT * FROM admin_events ORDER BY created_at DESC` as Record<string,unknown>[];
  else return Response.json({error:"Unknown export"},{status:400});
  await logAdminAction({action:"export.download",entityType:type,after:{records:rows.length}},actor);
  return new Response(csv(rows),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="qeixova-${type}-${new Date().toISOString().slice(0,10)}.csv"`}});
}
