"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import BusinessSidebar from "@/components/BusinessSidebar";
import BusinessLoading from "@/components/BusinessLoading";

type Row={id:number;title:string;status:string;submissions:number;approved:number;pending:number;rejected:number;budget_used:number;total_budget:number;refunded_amount:number;expires_at:string|null};
export default function AnalyticsPage(){
 const router=useRouter();
 const [business,setBusiness]=useState<{name:string}|null>(null); const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true);
 const [currentTime,setCurrentTime]=useState(0);
 useEffect(()=>{setCurrentTime(Date.now());Promise.all([fetch('/api/business/me'),fetch('/api/business/analytics')]).then(async([me,analytics])=>{if(me.status===401||analytics.status===401){router.replace('/business/login');return;}const[m,a]=await Promise.all([me.json(),analytics.json()]);setBusiness(m.business);setRows(a.campaigns||[])}).finally(()=>setLoading(false))},[router]);
 const totals=useMemo(()=>rows.reduce((a,r)=>({subs:a.subs+Number(r.submissions),approved:a.approved+Number(r.approved),spent:a.spent+Number(r.budget_used),refund:a.refund+Number(r.refunded_amount)}),{subs:0,approved:0,spent:0,refund:0}),[rows]);
 if(loading||!business)return <BusinessLoading title="Loading analytics" detail="Calculating campaign performance and financial results."/>;
 const download=()=>window.open('/api/business/reports?type=campaigns','_blank');
 return <><BusinessSidebar name={business.name}/><main className="page-body business-page-pro"><div className="businessWorkspace">
  <section className="adsPanel" style={{padding:24,display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><p className="businessEyebrow">Performance center</p><h1 className="businessPageTitle">Campaign analytics</h1><p className="businessIdentityLine">Results, approval quality, spending and refunds in one place.</p></div><button className="businessPrimaryLink" onClick={download}>Export CSV</button></section>
  <section className="businessMetricGrid businessCompactMetrics">{[['Campaigns',rows.length],['Submissions',totals.subs],['Approved',totals.approved],['QLT spent',totals.spent],['QLT refunded',totals.refund]].map(([l,v])=><article className="adsPanel businessStatTile warning" key={l}><span>{l}</span><strong>{Number(v).toLocaleString()}</strong></article>)}</section>
  <section className="adsPanel" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:760}}><thead><tr>{['Campaign','Status','Approval rate','Submissions','Budget used','Refunded','Time left'].map(h=><th key={h} style={{padding:14,textAlign:'left',color:'#aaa',fontSize:11}}>{h}</th>)}</tr></thead><tbody>{rows.map(r=>{const rate=r.submissions?Math.round(r.approved/r.submissions*100):0;const left=r.expires_at?Math.max(0,new Date(r.expires_at).getTime()-currentTime):0;return <tr key={r.id} style={{borderTop:'1px solid #1c1c1c'}}><td style={{padding:14}}><Link href={`/business/tasks/${r.id}`} style={{color:'#fff',fontWeight:800}}>{r.title}</Link></td><td>{r.status}</td><td>{rate}%</td><td>{r.submissions}</td><td>{Number(r.budget_used).toLocaleString()} QLT</td><td>{Number(r.refunded_amount).toLocaleString()} QLT</td><td>{r.expires_at?(left?`${Math.ceil(left/86400000)} days`:'Ended'):'Not started'}</td></tr>})}</tbody></table>{rows.length===0&&<p style={{padding:24,color:'#aaa'}}>Analytics will appear after your first campaign.</p>}</section>
 </div></main></>;
}
