import { NextRequest, NextResponse } from "next/server";
import { ensureAdminPlatformTables } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";
import { sendAdminOperationsReportEmail } from "@/lib/email";
import { ensureUniversalCampaignTables } from "@/lib/universalCampaignEngine";

export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 await ensureAdminPlatformTables();
 await ensureUniversalCampaignTables();
 const rows=await sql`SELECT value FROM platform_settings WHERE key='platform_controls'`;
 const settings=(rows[0]?.value??{}) as {reportSchedule?:string;reportEmail?:string};
 const now=new Date(),schedule=settings.reportSchedule??"off";
 const shouldRun=schedule==="daily"||(schedule==="weekly"&&now.getUTCDay()===1)||(schedule==="monthly"&&now.getUTCDate()===1);
 if(!shouldRun||!settings.reportEmail)return NextResponse.json({ok:true,skipped:true,reason:"Report is not scheduled for today"});
 const [users,businesses,campaigns,proofs,payouts,disputes]=await Promise.all([sql`SELECT COUNT(*)::int count FROM users`,sql`SELECT COUNT(*)::int count FROM businesses`,sql`SELECT COUNT(*)::int count FROM tasks`,sql`SELECT COUNT(*)::int count FROM completions WHERE status='pending'`,sql`SELECT COUNT(*)::int count FROM transactions WHERE type='debit' AND status IN('pending','processing')`,sql`SELECT COUNT(*)::int count FROM campaign_disputes WHERE status='open'`]);
 const summary={users:users[0].count,businesses:businesses[0].count,campaigns:campaigns[0].count,pendingProofs:proofs[0].count,openPayouts:payouts[0].count,openDisputes:disputes[0].count};
 const sent=await sendAdminOperationsReportEmail(settings.reportEmail,summary);
 await sql`INSERT INTO admin_report_runs(schedule,recipient,status,summary,error) VALUES (${schedule},${settings.reportEmail},${sent?"sent":"failed"},${JSON.stringify(summary)},${sent?null:"Email transport unavailable"})`;
 return NextResponse.json({ok:sent,summary},{status:sent?200:503});
}
