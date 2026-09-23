"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function BusinessLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", code: "" });
  const [requiresTwoFactor,setRequiresTwoFactor]=useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/business/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok && data.requiresTwoFactor) { setRequiresTwoFactor(true); setError(data.message||""); }
    else if (res.ok) router.push("/business/dashboard");
    else setError(data.error || "Login failed");
    setLoading(false);
  };

  const inp: React.CSSProperties = {
    width: "100%", marginTop: 7, padding: "13px 14px",
    borderRadius: 11, border: "1.5px solid #1e1e1e",
    fontSize: 14, outline: "none", color: "#F5F5F5", background: "#0d0d0d",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Image src="/qeixova-icon.png" alt="Qeixova" width={30} height={30} style={{ borderRadius: 8, objectFit: "contain" }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: "#F5F5F5" }}>Qeixova</span>
          <span style={{ fontSize: 10, color: "#F5A623", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 6, padding: "2px 8px", fontWeight: 700, letterSpacing: 0.5 }}>BUSINESS</span>
        </Link>
        <Link href="/register" style={{ fontSize: 13, color: "#F5A623", fontWeight: 700, textDecoration: "none" }}>Create account →</Link>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #F5A623, #d89420)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 28px rgba(245,166,35,0.3)" }}>
              <Image src="/qeixova-icon.png" alt="Qeixova" width={36} height={36} style={{ objectFit: "contain", filter: "brightness(0)" }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#F5F5F5", marginBottom: 6, letterSpacing: -0.5 }}>Business Portal</h1>
            <p style={{ fontSize: 14, color: "#bbb" }}>Sign in to manage your campaigns</p>
          </div>

          {/* Card */}
          <div style={{ background: "#0a0a0a", borderRadius: 20, padding: "28px 24px", border: "1px solid #161616" }}>
            {error && (
              <div style={{ background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)", borderRadius: 10, padding: "11px 14px", marginBottom: 20, fontSize: 13, color: "#e53e3e", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠️</span> {error}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.8, textTransform: "uppercase" }}>Email</label>
                <input type="email" placeholder="business@company.com" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required style={inp}
                  onFocus={e => (e.target.style.borderColor = "#F5A623")} onBlur={e => (e.target.style.borderColor = "#1e1e1e")} />
              </div>
              {requiresTwoFactor&&<div><label style={{fontSize:11,fontWeight:700,color:'#aaa'}}>SECURITY CODE</label><input inputMode="numeric" maxLength={6} placeholder="6-digit email code" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value.replace(/\D/g,'')}))} required style={inp}/></div>}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.8, textTransform: "uppercase" }}>Password</label>
                </div>
                <input type="password" placeholder="Your password" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required style={inp}
                  onFocus={e => (e.target.style.borderColor = "#F5A623")} onBlur={e => (e.target.style.borderColor = "#1e1e1e")} />
              </div>
              <button type="submit" disabled={loading} style={{
                background: loading ? "#111" : "linear-gradient(135deg, #F5A623, #d89420)",
                color: loading ? "#aaa" : "#000", border: "none", borderRadius: 12,
                padding: "14px", fontWeight: 800, fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
                boxShadow: loading ? "none" : "0 6px 20px rgba(245,166,35,0.28)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: "2px solid #444", borderTopColor: "#ccc", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                    Signing in...
                  </>
                ) : "Login →"}
              </button>
            </form>
            <p style={{ textAlign: "center", fontSize: 13, color: "#999", marginTop: 20 }}>
              <Link href="/forgot-password" style={{color:'#F5A623',fontWeight:700,textDecoration:'none'}}>Forgot password?</Link><br/><br/>
              No account?{" "}
              <Link href="/register" style={{ color: "#F5A623", fontWeight: 700, textDecoration: "none" }}>Create one</Link>
            </p>
          </div>

          {/* Account type switcher */}
          <div style={{ marginTop: 20, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(245,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/icon-task.svg" width={14} height={14} style={{ filter: "invert(72%) sepia(60%) saturate(500%) hue-rotate(5deg)" }} alt="" />
              </div>
              <span style={{ fontSize: 12, color: "#bbb" }}>Business Login</span>
            </div>
            <Link href="/login" style={{ fontSize: 12, color: "#1AEF22", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(26,239,34,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/icon-profile.svg" width={12} height={12} style={{ filter: "invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)" }} alt="" />
              </div>
              Growth Partner Login →
            </Link>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
