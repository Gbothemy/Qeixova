import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";

const csv=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
export async function GET(req:NextRequest){
 const session=await getBusinessSession(); if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const type=req.nextUrl.searchParams.get('type')||'transactions'; const id=Number(req.nextUrl.searchParams.get('id'))||0;
 let name='qeixova-report.csv'; let lines:string[]=[];
 if(type==='campaigns'){
  const rows=await sql`SELECT t.id,t.title,t.category,t.task_status,t.total_budget,t.budget_used,t.created_at,t.approved_at,t.expires_at,COUNT(c.id)::int submissions,COUNT(c.id) FILTER(WHERE c.status='approved')::int approved,COUNT(c.id) FILTER(WHERE c.status='rejected')::int rejected FROM tasks t LEFT JOIN completions c ON c.task_id=t.id WHERE t.business_id=${session.businessId} AND COALESCE(t.task_status,'')<>'deleted' GROUP BY t.id ORDER BY t.created_at DESC`;
  lines=['Campaign ID,Title,Category,Status,Budget,Spent,Submissions,Approved,Rejected,Created,Activated,Expires',...rows.map(r=>[r.id,r.title,r.category,r.task_status,r.total_budget,r.budget_used,r.submissions,r.approved,r.rejected,r.created_at,r.approved_at,r.expires_at].map(csv).join(','))]; name='qeixova-campaign-report.csv';
 }else{
  const rows=await sql`SELECT id,type,amount,label,status,provider,reference,created_at FROM business_transactions WHERE business_id=${session.businessId} AND (${id}=0 OR id=${id}) ORDER BY created_at DESC`;
  lines=['Transaction ID,Date,Type,Description,Amount QLT,Status,Provider,Reference',...rows.map(r=>[r.id,r.created_at,r.type,r.label,r.amount,r.status,r.provider,r.reference].map(csv).join(','))]; name=id?`qeixova-receipt-${id}.csv`:'qeixova-wallet-statement.csv';
 }
 return new NextResponse('\uFEFF'+lines.join('\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${name}"`}});
}
