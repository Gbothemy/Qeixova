"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessSidebar from "@/components/BusinessSidebar";
import BusinessLoading from "@/components/BusinessLoading";

type Session = { id: string; ip_address: string; user_agent: string; created_at: string; last_seen_at: string };
type History = { id: number; success: boolean; ip_address: string; user_agent: string; created_at: string };
type SecurityData = { twoFactorEnabled: boolean; currentSessionId: string; sessions: Session[]; history: History[] };
type BusinessData = { name: string };
type ApiResponse = Partial<SecurityData> & { error?: string; message?: string; business?: BusinessData };

async function readJson(response: Response): Promise<ApiResponse> {
  const body = await response.text();
  if (!body) return { error: `The server returned an empty response (${response.status}).` };
  try {
    return JSON.parse(body) as ApiResponse;
  } catch {
    return { error: `The server returned an invalid response (${response.status}).` };
  }
}

export default function SecurityPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [data, setData] = useState<SecurityData | null>(null);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [meResponse, securityResponse] = await Promise.all([
        fetch("/api/business/me"),
        fetch("/api/business/security"),
      ]);

      if (meResponse.status === 401 || securityResponse.status === 401) {
        router.replace("/business/login");
        return;
      }

      const [me, security] = await Promise.all([
        readJson(meResponse),
        readJson(securityResponse),
      ]);

      if (!meResponse.ok) throw new Error(me.error || "Could not load your business account.");
      if (!securityResponse.ok) throw new Error(security.error || "Could not load security settings.");
      if (!me.business || !Array.isArray(security.sessions) || !Array.isArray(security.history)) {
        throw new Error("The server returned incomplete security information.");
      }

      setBusiness(me.business);
      setData(security as SecurityData);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load security settings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (body: object) => {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/business/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readJson(response);
      setNotice(result.message || result.error || (response.ok ? "Saved" : "Could not save"));
      if (response.ok) await load();
    } catch {
      setNotice("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && (!business || !data)) {
    return <BusinessLoading title="Loading security" detail="Reviewing account protection and active sessions." />;
  }

  if (loadError || !business || !data) {
    return (
      <main className="page-body business-page-pro">
        <div className="businessWorkspace">
          <section className="adsPanel" style={{ padding: 24 }}>
            <p className="businessEyebrow">Account protection</p>
            <h1 className="businessPageTitle">Security</h1>
            <p role="alert" style={{ color: "var(--danger)", margin: "12px 0 18px" }}>
              {loadError || "Security information is not available right now."}
            </p>
            <button className="businessPrimaryLink" onClick={() => void load()} disabled={loading}>
              {loading ? "Retrying…" : "Try again"}
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      <BusinessSidebar name={business.name} />
      <main className="page-body business-page-pro">
        <div className="businessWorkspace">
          <section className="adsPanel" style={{ padding: 24 }}>
            <p className="businessEyebrow">Account protection</p>
            <h1 className="businessPageTitle">Security</h1>
            <p className="businessIdentityLine">Password, two-step verification, sessions and login history.</p>
          </section>

          {notice && <div className="businessErrorBanner" role="status">{notice}</div>}

          <section className="adsPanel" style={{ padding: 22 }}>
            <h2>Email two-step verification</h2>
            <p style={{ color: "var(--muted)", margin: "8px 0 16px" }}>Require a one-time email code whenever your password is used to sign in.</p>
            <button className="businessPrimaryLink" disabled={saving} onClick={() => void patch({ action: "two_factor", enabled: !data.twoFactorEnabled })}>
              {data.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          </section>

          <section className="adsPanel" style={{ padding: 22 }}>
            <h2>Change password</h2>
            <div style={{ display: "grid", gap: 10, maxWidth: 420, marginTop: 14 }}>
              <input type="password" placeholder="Current password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
              <input type="password" placeholder="New password (8+ characters)" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
              <button className="businessPrimaryLink" disabled={saving} onClick={() => void patch({ action: "password", ...form })}>Update password</button>
            </div>
          </section>

          <section className="adsPanel" style={{ padding: 22 }}>
            <h2>Active sessions</h2>
            {data.sessions.map((session) => (
              <div key={session.id} style={{ padding: "13px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <strong>{session.id === data.currentSessionId ? "This device" : "Signed-in device"}</strong>
                  <p style={{ color: "var(--muted-2)", fontSize: 12 }}>{session.ip_address} · {session.user_agent?.slice(0, 70)} · Active {new Date(session.last_seen_at).toLocaleString()}</p>
                </div>
                {session.id !== data.currentSessionId && <button disabled={saving} onClick={() => void patch({ action: "revoke", sessionId: session.id })}>Sign out</button>}
              </div>
            ))}
            {data.sessions.length === 0 && <p style={{ color: "var(--muted)", marginTop: 10 }}>No active sessions found.</p>}
          </section>

          <section className="adsPanel" style={{ padding: 22 }}>
            <h2>Login history</h2>
            {data.history.map((entry) => (
              <div key={entry.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--border)", color: entry.success ? "var(--text)" : "#ff7777" }}>
                {entry.success ? "Successful" : "Failed"} · {entry.ip_address} · {new Date(entry.created_at).toLocaleString()}
              </div>
            ))}
            {data.history.length === 0 && <p style={{ color: "var(--muted)", marginTop: 10 }}>No login history found.</p>}
          </section>
        </div>
      </main>
    </>
  );
}
