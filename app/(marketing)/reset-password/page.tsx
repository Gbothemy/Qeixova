"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function PasswordVisibilityButton({ visible, onClick, label }: { visible: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, display: "grid", placeItems: "center", border: "1px solid rgba(26, 239, 34, .22)", borderRadius: 10, background: "rgba(26, 239, 34, .08)", color: "#1aef22", cursor: "pointer", padding: 0 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
        {!visible && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { setDone(true); setTimeout(() => router.push("/login"), 2000); }
    else setError(data.error || "Reset failed. Please try again.");
  };

  return (
    <div style={{ background: "#111111", borderRadius: 24, padding: "36px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid #222222" }}>
      {done ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontWeight: 800, fontSize: 20, color: "#F5F5F5", marginBottom: 10 }}>Password reset!</h2>
          <p style={{ fontSize: 14, color: "#bbbbbb" }}>Redirecting you to login...</p>
        </div>
      ) : (
        <>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "#F5F5F5", marginBottom: 6 }}>Set new password</h1>
          <p style={{ fontSize: 13, color: "#bbbbbb", marginBottom: 28 }}>Choose a strong password for your account.</p>
          {error && (
            <div style={{ background: "rgba(229,62,62,0.1)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 10, padding: "11px 14px", marginBottom: 16, fontSize: 13, color: "#e53e3e" }}>⚠️ {error}</div>
          )}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔒</span>
              <input type={showPassword ? "text" : "password"} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "13px 54px 13px 42px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 14, outline: "none", color: "#F5F5F5", background: "#1a1a1a" }}
                onFocus={(e) => (e.target.style.borderColor = "#1AEF22")} onBlur={(e) => (e.target.style.borderColor = "#999999")} />
              <PasswordVisibilityButton visible={showPassword} onClick={() => setShowPassword((v) => !v)} label={showPassword ? "Hide new password" : "Show new password"} />
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔐</span>
              <input type={showConfirm ? "text" : "password"} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                style={{ width: "100%", padding: "13px 54px 13px 42px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 14, outline: "none", color: "#F5F5F5", background: "#1a1a1a" }}
                onFocus={(e) => (e.target.style.borderColor = "#1AEF22")} onBlur={(e) => (e.target.style.borderColor = "#999999")} />
              <PasswordVisibilityButton visible={showConfirm} onClick={() => setShowConfirm((v) => !v)} label={showConfirm ? "Hide confirm password" : "Show confirm password"} />
            </div>
            <button type="submit" disabled={loading || !token} style={{ background: loading ? "#a0a0a0" : "linear-gradient(135deg, #1AEF22, #06B517)", color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 6px 20px rgba(26,239,34,0.35)" }}>
              {loading ? "Resetting..." : "Reset Password →"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1AEF22 0%, #06B517 45%, #000000 45%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/login" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #F5A623, #d89420)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 24px rgba(245,166,35,0.4)" }}>⚡</div>
            <span style={{ fontWeight: 900, fontSize: 22, color: "#fff", letterSpacing: -0.5 }}>Qeixova</span>
          </Link>
        </div>
        <Suspense fallback={<div style={{ background: "#111111", borderRadius: 24, padding: 36, textAlign: "center", color: "#F5F5F5" }}>Loading...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
