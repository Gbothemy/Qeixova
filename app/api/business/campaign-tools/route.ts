import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { ensureUniversalCampaignTables } from "@/lib/universalCampaignEngine";

export async function GET(req:NextRequest){
 const s=await getBusinessSession(); if(!s)return NextResponse.json({error:'Unauthorized'},{status:401}); await ensureUniversalCampaignTables();
 await sql`ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS business_id INTEGER`;
 const source=Number(req.nextUrl.searchParams.get('source'))||0;
 if(source){const rows=await sql`SELECT t.*,c.mission_category,c.campaign_goal FROM tasks t LEFT JOIN campaigns c ON c.task_id=t.id WHERE t.id=${source} AND t.business_id=${s.businessId}`; if(!rows.length)return NextResponse.json({error:'Campaign not found'},{status:404}); const t=rows[0]; const m=t.campaign_metadata||{}; return NextResponse.json({draft:{version:1,savedAt:new Date().toISOString(),stepIndex:0,categoryId:m.missionCategoryId||'social',goal:t.campaign_goal||t.category,title:`Copy of ${t.title}`,objective:m.objective||t.instructions,contentType:m.contentType||'Campaign content',contentCaption:m.contentCaption||'',contentLink:t.task_link||'',assetName:m.assetName||'',assetDataUrl:m.assetDataUrl||'',assetMimeType:m.assetMimeType||'',bundleId:m.bundleId||'',selectedPricingIds:m.selectedPricingIds||[],actions:t.steps||[],appContributorInstructions:m.appContributorInstructions||'',audience:m.audience||t.target_professions||[],selectedInterests:m.selectedInterests||t.target_interests||[],reachId:'starter',customContributors:String(t.target_completion_count||''),locationMode:(t.target_states||[]).length?'exact':'nationwide',targetLocations:m.targetLocation?.locations||[],locationSearchDraft:{country:'Nigeria',state:'',city:'',address:''}}});}
 const templates=await sql`SELECT id,title,mission_category,campaign_goal,default_reward_qlt,default_contributors,metadata,created_at FROM campaign_templates WHERE business_id=${s.businessId} AND is_active=true ORDER BY created_at DESC`; return NextResponse.json({templates});
}
export async function POST(req:NextRequest){
 const s=await getBusinessSession(); if(!s)return NextResponse.json({error:'Unauthorized'},{status:401}); await ensureUniversalCampaignTables(); await sql`ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS business_id INTEGER`;
 const {taskId}=await req.json(); const rows=await sql`SELECT * FROM tasks WHERE id=${Number(taskId)} AND business_id=${s.businessId}`; if(!rows.length)return NextResponse.json({error:'Campaign not found'},{status:404}); const t=rows[0];
 const key=`business-${s.businessId}-${Date.now()}`; const inserted=await sql`INSERT INTO campaign_templates(template_key,business_id,title,mission_category,campaign_goal,default_actions,default_platforms,default_reward_qlt,default_contributors,metadata) VALUES(${key},${s.businessId},${t.title},${t.category},${t.campaign_goal||t.category},${JSON.stringify(t.steps||[])}::jsonb,${JSON.stringify(t.target_platforms||[])}::jsonb,${t.reward},${t.target_completion_count},${JSON.stringify({sourceTaskId:t.id})}::jsonb) RETURNING id`; return NextResponse.json({ok:true,templateId:inserted[0].id});
}
