"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, challengeId: challengeId || undefined, code: code || undefined }),
      });
      const data = await res.json();
      if (data.requiresTwoFactor && !challengeId) {
        setChallengeId(data.challengeId);
        setDevelopmentCode(data.developmentCode ?? "");
      } else if (!res.ok) {
        setError(data.error ?? "Login failed");
      } else {
        router.push("/admin");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--qeixova-color-0a-0a-0a)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--qeixova-color-00-00-00)",
          borderRadius: 16,
          padding: "48px 40px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>Admin</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--qeixova-color-e5-e5-e5)" }}>
            Admin Portal
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--qeixova-color-33-33-33)", fontSize: 14 }}>
            Qeixova Administration
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!challengeId && <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--qeixova-color-55-55-55)", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid var(--qeixova-color-1f-1f-1f)",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="admin@qeixova.com"
            />
          </div>}

          {!challengeId && <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--qeixova-color-55-55-55)" }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPass((value) => !value)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--qeixova-color-e5-e5-e5)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: 0,
                }}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid var(--qeixova-color-1f-1f-1f)",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="Enter admin password"
            />
          </div>}
          {challengeId && <div style={{marginBottom:24}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"var(--qeixova-color-99-99-99)",marginBottom:6}}>Security code</label><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} required style={{width:"100%",boxSizing:"border-box",padding:"14px",border:"1.5px solid var(--qeixova-color-1f-1f-1f)",borderRadius:8,fontSize:22,textAlign:"center",letterSpacing:8}} placeholder="000000"/><p style={{fontSize:12,color:"var(--qeixova-color-88-88-88)"}}>Enter the six-digit code sent to your administrator email.{developmentCode?` Development code: ${developmentCode}`:""}</p></div>}

          {error && (
            <div
              style={{
                background: "#fff0f0",
                border: "1px solid #ffcccc",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#cc0000",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading ? "var(--qeixova-color-55-55-55)" : "#1AEF22",
              color: "var(--qeixova-color-00-00-00)",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying..." : challengeId ? "Verify & Sign In" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
