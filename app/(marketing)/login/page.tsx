"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setNotice("Email verified. You can sign in now.");
    } else if (params.has("verify_error")) {
      setError("Verification link is invalid or expired. Please register again or contact support.");
    }
    if (params.has("verified") || params.has("verify_error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setLoading(true);
    const payload = {
      email: form.email.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase(),
      password: form.password.replace(/[\u200B-\u200D\uFEFF]/g, ""),
    };

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) router.push("/dashboard");
    else setError(data.error || "Login failed. Please try again.");
    setLoading(false);
  };

  return (
    <main className="loginPage">
      <section className="loginStage">
        <section className="formPanel" aria-label="Contributor login form">
          <div className="formHeader">
            <p>Welcome back</p>
            <h2>Contributor login</h2>
            <span>Sign in with the email connected to your account.</span>
          </div>

          {error && <div className="alert errorAlert"><span>!</span>{error}</div>}
          {notice && <div className="alert noticeAlert">{notice}</div>}

          <form method="post" action="/api/auth/login" onSubmit={handleSubmit} className="loginForm">
            <label>
              Email address
              <span className="inputWrap">
                <img src="/icon-email.svg" width={16} height={16} alt="" />
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                  autoComplete="email"
                />
              </span>
            </label>

            <label>
              <span className="labelLine">
                Password
                <Link href="/forgot-password">Forgot password?</Link>
              </span>
              <span className="inputWrap">
                <img src="/icon-lock.svg" width={16} height={16} alt="" />
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  autoComplete="current-password"
                />
                <PasswordVisibilityButton visible={showPass} onClick={() => setShowPass((value) => !value)} label={showPass ? "Hide password" : "Show password"} />
              </span>
            </label>

            <button type="submit" disabled={loading} className="submitButton">
              {loading ? <><span className="spinner" />Signing in...</> : "Sign in"}
            </button>
          </form>

          <p className="createText">
            New to Qeixova? <Link href="/register">Create account</Link>
          </p>

          <div className="secondaryLinks" aria-label="Login navigation">
            <Link href="/business/login">Business login</Link>
            <Link href="/">Back home</Link>
          </div>
        </section>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

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

const styles = `
  .loginPage {
    min-height: 100vh;
    color: #f5f5f5;
    background:
      radial-gradient(circle at 50% 12%, rgba(26, 239, 34, 0.1), transparent 26%),
      radial-gradient(circle at 50% 100%, rgba(26, 239, 34, 0.06), transparent 34%),
      #050505;
  }

  .brandLink,
  .navAction,
  .labelLine a,
  .createText a {
    text-decoration: none;
  }

  .loginStage {
    width: min(100%, 480px);
    min-height: 100vh;
    margin: 0 auto;
    padding: 48px 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .formPanel {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 26px;
    background: linear-gradient(180deg, rgba(12, 12, 12, 0.94), rgba(5, 5, 5, 0.96));
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(26, 239, 34, 0.03) inset;
    backdrop-filter: blur(18px);
  }

  .formHeader p {
    margin: 0 0 12px;
    color: #1aef22;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }

  .formPanel {
    padding: 30px;
  }

  .formHeader h2 {
    margin: 0;
    color: #fff;
    font-size: 28px;
    line-height: 1.1;
    letter-spacing: 0;
  }

  .formHeader span {
    display: block;
    margin-top: 10px;
    color: #a8a8a8;
    font-size: 13px;
    line-height: 1.55;
  }

  .alert {
    margin-top: 20px;
    padding: 12px 14px;
    border-radius: 13px;
    font-size: 13px;
    font-weight: 750;
  }

  .errorAlert {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid rgba(229, 62, 62, 0.24);
    background: rgba(229, 62, 62, 0.08);
    color: #ff9a9a;
  }

  .errorAlert span {
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(229, 62, 62, 0.16);
    font-weight: 950;
  }

  .noticeAlert {
    border: 1px solid rgba(26, 239, 34, 0.24);
    background: rgba(26, 239, 34, 0.08);
    color: #1aef22;
  }

  .loginForm {
    display: grid;
    gap: 18px;
    margin-top: 26px;
  }

  .loginForm label {
    display: grid;
    gap: 8px;
    color: #b8b8b8;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: .75px;
    text-transform: uppercase;
  }

  .labelLine {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .labelLine a {
    color: #1aef22;
    font-size: 12px;
    font-weight: 850;
    letter-spacing: 0;
    text-transform: none;
  }

  .inputWrap {
    position: relative;
    display: block;
  }

  .inputWrap > img {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    opacity: .45;
    filter: brightness(0);
    pointer-events: none;
  }

  .loginForm input {
    width: 100%;
    min-height: 54px;
    border: 1px solid #272727;
    border-radius: 14px;
    background: #f1f6ff;
    color: #050505;
    padding: 14px 15px 14px 48px;
    font: inherit;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0;
    outline: none;
    text-transform: none;
    transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
  }

  .inputWrap input[type="password"],
  .inputWrap input[type="text"] {
    padding-right: 58px;
  }

  .loginForm input:focus {
    border-color: rgba(26, 239, 34, .78);
    background: #f5f8ff;
    box-shadow: 0 0 0 4px rgba(26, 239, 34, .12);
  }

  .loginForm input::placeholder {
    color: rgba(118, 128, 145, .68);
    font-size: 12px;
    font-weight: 400;
    opacity: 1;
  }

  .passwordToggle {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(26, 239, 34, .22);
    border-radius: 10px;
    background: rgba(26, 239, 34, .08);
    color: #1aef22;
    cursor: pointer;
    padding: 0;
  }

  .submitButton {
    min-height: 56px;
    margin-top: 6px;
    border: 0;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    background: linear-gradient(135deg, #1aef22, #08b818);
    color: #050505;
    cursor: pointer;
    font-size: 16px;
    font-weight: 950;
    box-shadow: 0 18px 42px rgba(26, 239, 34, 0.22);
  }

  .submitButton:disabled {
    opacity: .58;
    cursor: not-allowed;
    box-shadow: none;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0,0,0,.24);
    border-top-color: #050505;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  .createText {
    margin: 22px 0 0;
    text-align: center;
    color: #b8b8b8;
    font-size: 13px;
  }

  .createText a {
    color: #1aef22;
    font-weight: 850;
  }

  .secondaryLinks {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .secondaryLinks a {
    min-height: 38px;
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #f5f5f5;
    background: rgba(255, 255, 255, 0.035);
    font-size: 12px;
    font-weight: 850;
    text-decoration: none;
  }

  .secondaryLinks a:first-child {
    border-color: rgba(26, 239, 34, 0.26);
    color: #1aef22;
    background: rgba(26, 239, 34, 0.07);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 520px) {
    .loginStage {
      min-height: 100svh;
      padding: 22px 18px;
      align-items: center;
    }

    .formPanel {
      padding: 0;
      border-right: 0;
      border-left: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
    }

    .formHeader h2 {
      font-size: 27px;
    }

    .secondaryLinks {
      gap: 10px;
    }

    .secondaryLinks a {
      flex: 1 1 150px;
    }
  }
`;
void String.raw`
                    background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0,
                  }}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#a0a0a0" : "linear-gradient(135deg, #1AEF22, #06B517)",
                color: "#fff", border: "none",
                borderRadius: 14, padding: "15px",
                fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 6px 20px rgba(26,239,34,0.35)",
                transition: "all 0.2s", marginTop: 4,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                  Signing in...
                </>
              ) : "Login →"}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 20 }}>
          By signing in you agree to our{" "}
          <span style={{ color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>Terms</span> &amp;{" "}
          <span style={{ color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>Privacy Policy</span>
        </p>

        {/* Account type switcher */}
        <div style={{ marginTop: 20, background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(26,239,34,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/icon-profile.svg" width={14} height={14} style={{ filter: "invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)" }} alt="" />
            </div>
            <span style={{ fontSize: 12, color: "#bbb" }}>Contributor Login</span>
          </div>
          <Link href="/business/login" style={{ fontSize: 12, color: "#F5A623", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(245,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/icon-task.svg" width={12} height={12} style={{ filter: "invert(72%) sepia(60%) saturate(500%) hue-rotate(5deg)" }} alt="" />
            </div>
            Business Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
`;

