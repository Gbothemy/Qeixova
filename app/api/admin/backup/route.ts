import { NextRequest, NextResponse } from "next/server";
import { getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";

export async function GET(){
 const actor=await getAdminContext();if(!actor||actor.role!=="super_admin")return NextResponse.json({error:"Unauthorized"},{status:401});
 const [users,businesses,tasks,completions,transactions,config]=await Promise.all([sql`SELECT * FROM users`,sql`SELECT * FROM businesses`,sql`SELECT * FROM tasks`,sql`SELECT * FROM completions`,sql`SELECT * FROM transactions`,sql`SELECT * FROM system_config`]);
 const backup={version:1,createdAt:new Date().toISOString(),tables:{users,businesses,tasks,completions,transactions,system_config:config}};
 await logAdminAction({action:"backup.exported",entityType:"database",after:{counts:Object.fromEntries(Object.entries(backup.tables).map(([k,v])=>[k,v.length]))}},actor);
 return new NextResponse(JSON.stringify(backup),{headers:{"Content-Type":"application/json","Content-Disposition":`attachment; filename="qeixova-backup-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"no-store"}});
}

export async function POST(req:NextRequest){
 const actor=await getAdminContext();if(!actor||actor.role!=="super_admin")return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json();if(body.confirmation!=="RESTORE BACKUP"||body.backup?.version!==1||!body.backup?.tables)return NextResponse.json({error:"A valid version 1 backup and RESTORE BACKUP confirmation are required"},{status:400});
 const tables=body.backup.tables as Record<string,unknown[]>;
 const allowed=["users","businesses","tasks","completions","transactions","system_config"];
 for(const table of allowed){const rows=Array.isArray(tables[table])?tables[table]:[];if(!rows.length)continue;const payload=JSON.stringify(rows);
  if(table==="users")await sql`INSERT INTO users SELECT * FROM json_populate_recordset(NULL::users,${payload}::json) ON CONFLICT(id) DO NOTHING`;
  else if(table==="businesses")await sql`INSERT INTO businesses SELECT * FROM json_populate_recordset(NULL::businesses,${payload}::json) ON CONFLICT(id) DO NOTHING`;
  else if(table==="tasks")await sql`INSERT INTO tasks SELECT * FROM json_populate_recordset(NULL::tasks,${payload}::json) ON CONFLICT(id) DO NOTHING`;
  else if(table==="completions")await sql`INSERT INTO completions SELECT * FROM json_populate_recordset(NULL::completions,${payload}::json) ON CONFLICT(id) DO NOTHING`;
  else if(table==="transactions")await sql`INSERT INTO transactions SELECT * FROM json_populate_recordset(NULL::transactions,${payload}::json) ON CONFLICT(id) DO NOTHING`;
  else if(table==="system_config")await sql`INSERT INTO system_config SELECT * FROM json_populate_recordset(NULL::system_config,${payload}::json) ON CONFLICT(key) DO NOTHING`;
 }
 await logAdminAction({action:"backup.restored",entityType:"database",reason:"Typed restore confirmation",after:{tables:allowed}},actor);
 return NextResponse.json({ok:true,message:"Backup recovery completed. Existing records were preserved; missing records were restored."});
}
