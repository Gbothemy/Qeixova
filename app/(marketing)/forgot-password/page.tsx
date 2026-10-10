"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1AEF22 0%, #06B517 45%, var(--qeixova-color-ff-ff-ff) 45%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/login" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #F5A623, #d89420)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 24px rgba(245,166,35,0.4)" }}>⚡</div>
            <span style={{ fontWeight: 900, fontSize: 22, color: "var(--qeixova-color-00-00-00)", letterSpacing: -0.5 }}>Qeixova</span>
          </Link>
        </div>
        <div style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 24, padding: "36px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
              <h2 style={{ fontWeight: 800, fontSize: 20, color: "var(--qeixova-color-0a-0a-0a)", marginBottom: 10 }}>Check your email</h2>
              <p style={{ fontSize: 14, color: "var(--qeixova-color-44-44-44)", lineHeight: 1.6, marginBottom: 24 }}>
                If <strong>{email}</strong> is registered, you&apos;ll receive a password reset link shortly.
              </p>
              <Link href="/login" style={{ display: "block", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "var(--qeixova-color-00-00-00)", textDecoration: "none", borderRadius: 14, padding: "14px", fontWeight: 800, fontSize: 15, textAlign: "center" }}>
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--qeixova-color-0a-0a-0a)", marginBottom: 6 }}>Reset password</h1>
              <p style={{ fontSize: 13, color: "var(--qeixova-color-44-44-44)", marginBottom: 28 }}>Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>📧</span>
                  <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    style={{ width: "100%", padding: "13px 14px 13px 42px", borderRadius: 12, border: "1.5px solid var(--qeixova-color-cc-cc-cc)", fontSize: 14, outline: "none", color: "var(--qeixova-color-0a-0a-0a)", background: "var(--qeixova-color-e5-e5-e5)" }}
                    onFocus={(e) => (e.target.style.borderColor = "#1AEF22")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--qeixova-color-66-66-66)")}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ background: loading ? "var(--qeixova-color-5f-5f-5f)" : "linear-gradient(135deg, #1AEF22, #06B517)", color: "var(--qeixova-color-00-00-00)", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 6px 20px rgba(26,239,34,0.35)" }}>
                  {loading ? "Sending..." : "Send Reset Link →"}
                </button>
              </form>
              <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--qeixova-color-44-44-44)" }}>
                Remember your password? <Link href="/login" style={{ color: "#1AEF22", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
