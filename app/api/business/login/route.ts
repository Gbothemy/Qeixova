import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signBusinessToken } from "@/lib/businessAuth";
import { cleanLoginEmail, getPasswordCandidates } from "@/lib/loginInput";
import { ensureBusinessSecurityTables, hashCode, newSessionId } from "@/lib/businessSecurity";
import { sendBusinessSecurityCodeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  let stage = "parse_request";
  try {
    const { email, password, code } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const cleanEmail = cleanLoginEmail(email);
    stage = "load_business";
    const rows = await sql`SELECT * FROM businesses WHERE email = ${cleanEmail}`;
    if (rows.length === 0) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const business = rows[0];
    await ensureBusinessSecurityTables();
    stage = "verify_password";
    const valid = (await Promise.all(
      getPasswordCandidates(password).map((candidate) => bcrypt.compare(candidate, business.password)),
    )).some(Boolean);
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'Unknown'; const ua=req.headers.get('user-agent')||'Unknown';
    if (!valid) { await sql`INSERT INTO business_login_history(business_id,email,success,ip_address,user_agent) VALUES(${business.id},${cleanEmail},FALSE,${ip},${ua})`; return NextResponse.json({ error: "Invalid email or password" }, { status: 401 }); }
    if (business.email_verified === false) {
      return NextResponse.json({ error: "Please verify your email before signing in. Check your inbox for the verification link." }, { status: 403 });
    }

    if(business.two_factor_enabled){
      if(!code){const otp=String(Math.floor(100000+Math.random()*900000)); await sql`DELETE FROM business_two_factor_codes WHERE business_id=${business.id}`; await sql`INSERT INTO business_two_factor_codes(business_id,code_hash,expires_at) VALUES(${business.id},${hashCode(otp)},NOW()+INTERVAL '10 minutes')`; await sendBusinessSecurityCodeEmail(business.email,business.name,otp); return NextResponse.json({requiresTwoFactor:true,message:'Enter the security code sent to your email.'});}
      const codes=await sql`DELETE FROM business_two_factor_codes WHERE business_id=${business.id} AND code_hash=${hashCode(String(code))} AND expires_at>NOW() RETURNING id`; if(!codes.length)return NextResponse.json({error:'Invalid or expired security code'},{status:401});
    }
    stage = "sign_session";
    const sessionId=newSessionId(); await sql`INSERT INTO business_sessions(id,business_id,ip_address,user_agent) VALUES(${sessionId},${business.id},${ip},${ua})`; await sql`INSERT INTO business_login_history(business_id,email,success,ip_address,user_agent) VALUES(${business.id},${cleanEmail},TRUE,${ip},${ua})`;
    const token = signBusinessToken({ businessId: business.id, email: business.email, name: business.name, sessionId });

    stage = "set_cookie";
    const res = NextResponse.json({ ok: true, business: { id: business.id, name: business.name, email: business.email } });
    res.cookies.set("business_token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    return res;
  } catch (err) {
    console.error("Business login failed", { stage, error: err });
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: process.env.NODE_ENV === "production" ? "Server error" : `Server error (${stage})`,
      ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
    }, { status: 500 });
  }
}
