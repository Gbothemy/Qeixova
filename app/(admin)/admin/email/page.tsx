"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Audience = "contributors" | "businesses";
type Recipient = { id: number; name: string; email: string; rank_name?: string | null; level_number?: number | null };
type Mission = { id: number; title: string; target_interests: string[] };
type Rank = { id: number; level_number: number; name: string; min_qlt: number };

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #d7dce3",
  borderRadius: 9, background: "var(--qeixova-color-ff-ff-ff)", color: "var(--qeixova-color-22-22-22)", fontSize: 14,
};

export default function AdminEmailPage() {
  const [audience, setAudience] = useState<Audience>("contributors");
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [missionId, setMissionId] = useState("");
  const [rankId, setRankId] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [recipientError, setRecipientError] = useState("");
  const [deliveryConfigured, setDeliveryConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const params = new URLSearchParams({ audience, search: search.trim(), ...(missionId ? { missionId } : {}), ...(rankId ? { rankId } : {}) });
      const response = await fetch(`/api/admin/email?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load recipients.");
      setRecipientError("");
      setRecipients(data.recipients ?? []);
      setMissions(data.missions ?? []);
      setRanks(data.ranks ?? []);
      setMatchedIds(data.matchedIds ?? []);
      setDeliveryConfigured(Boolean(data.deliveryConfigured));
      if (missionId && audience === "contributors") setSelected(data.matchedIds ?? []);
    } catch (error) {
      setRecipients([]);
      const message = error instanceof Error ? error.message : "Could not load recipients.";
      setRecipientError(message);
      setNotice({ type: "error", message });
    } finally {
      setLoadingRecipients(false);
    }
  }, [audience, search, missionId, rankId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRecipients(); }, 250);
    return () => window.clearTimeout(timer);
  }, [loadRecipients]);

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selected.includes(recipient.id)),
    [recipients, selected],
  );

  function toggleRecipient(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function changeAudience(value: Audience) {
    setAudience(value);
    setMissionId("");
    setRankId("");
    setSelected([]);
  }

  async function sendMessage() {
    if (!selected.length || !subject.trim() || !message.trim()) return;
    const confirmed = window.confirm(`Send “${subject.trim()}” to ${selected.length} ${audience === "contributors" ? "contributors" : "businesses"}?`);
    if (!confirmed) return;

    setSending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, recipientIds: selected, subject, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.sent) throw new Error(data.error || "Email could not be sent.");
      const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;
      setNotice({
        type: failedCount ? "error" : "success",
        message: failedCount
          ? `Sent to ${data.sent} of ${data.selected}. ${failedCount} could not be delivered.`
          : `Email sent to ${data.sent} ${audience === "contributors" ? "contributors" : "businesses"}.`,
      });
      if (!failedCount) {
        setSelected([]);
        setSubject("");
        setMessage("");
      } else {
        setSelected(data.failed.map((recipient: { id: number }) => recipient.id));
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Email could not be sent." });
    } finally {
      setSending(false);
    }
  }

  const allVisibleSelected = recipients.length > 0 && recipients.every((recipient) => selected.includes(recipient.id));

  return (
    <div className="adminPage">
      <section className="adminPageHeader">
        <div>
          <p className="adminEyebrow">Account communications</p>
          <h1>Email Center</h1>
          <p>Browse every contributor or business, narrow the list, and choose exactly who receives your message.</p>
        </div>
      </section>

      {notice && (
        <div className={`adminResult${notice.type === "error" ? " error" : ""}`} style={{ marginTop: 16 }}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
        </div>
      )}

      {deliveryConfigured === false && (
        <div className="adminResult error" style={{ marginTop: 16 }}>
          <span>Email delivery is not configured. Set SMTP or Gmail credentials before sending.</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18, marginTop: 18, alignItems: "start" }}>
        <section className="adminPanel" style={{ display: "grid", gap: 15 }}>
          <div>
            <label htmlFor="email-audience" style={labelStyle}>Recipient type</label>
            <select id="email-audience" style={inputStyle} value={audience} onChange={(event) => changeAudience(event.target.value as Audience)}>
              <option value="contributors">Contributors</option>
              <option value="businesses">Businesses</option>
            </select>
          </div>

          {audience === "contributors" && (
            <>
              <div>
                <label htmlFor="email-rank" style={labelStyle}>Contributor rank · QLT points</label>
                <select id="email-rank" style={inputStyle} value={rankId} onChange={(event) => setRankId(event.target.value)}>
                  <option value="">All ranks</option>
                  {ranks.map((rank) => <option key={rank.id} value={rank.id}>{rank.name} · Level {rank.level_number} · {Number(rank.min_qlt).toLocaleString()}+ QLT</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="email-mission" style={labelStyle}>Mission interest match</label>
                <select id="email-mission" style={inputStyle} value={missionId} onChange={(event) => setMissionId(event.target.value)}>
                  <option value="">All contributors (no mission filter)</option>
                  {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title}{mission.target_interests.length ? ` · ${mission.target_interests.join(", ")}` : " · all interests"}</option>)}
                </select>
                <small style={{ display: "block", marginTop: 5, color: "#667085", lineHeight: 1.5 }}>
                  {missionId ? `${matchedIds.length} contributors match this mission and rank in the current results.` : "All contributors are shown. Choose a mission only when you want to filter by interests."}
                </small>
              </div>
            </>
          )}

          <div>
            <label htmlFor="recipient-search" style={labelStyle}>Find recipients</label>
            <input id="recipient-search" style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ color: "#344054", fontSize: 13 }}>{loadingRecipients ? "Loading recipients…" : `${recipients.length} ${audience === "contributors" ? "contributors" : "businesses"} shown · ${selected.length} selected`}</strong>
            <button type="button" onClick={() => setSelected(allVisibleSelected ? [] : recipients.map((recipient) => recipient.id))} disabled={loadingRecipients || recipients.length === 0} style={textButtonStyle}>
              {allVisibleSelected ? "Clear selection" : `Select all ${audience}`}
            </button>
          </div>

          <div role="group" aria-label="Recipient list" style={{ maxHeight: 380, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            {!loadingRecipients && recipients.length === 0 ? <p style={{ margin: 0, padding: 18, color: "#667085", fontSize: 13 }}>{recipientError || "No accounts with email addresses match this search."}</p> : null}
            {recipients.map((recipient) => (
              <label key={`${audience}-${recipient.id}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 12px", borderBottom: "1px solid #eef0f3", cursor: "pointer" }}>
                <input type="checkbox" checked={selected.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} style={{ marginTop: 3 }} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", color: "#344054", fontSize: 13 }}>{recipient.name || "Unnamed account"}</strong>
                  <small style={{ display: "block", color: "#667085", overflowWrap: "anywhere" }}>{recipient.email}</small>
                  {audience === "contributors" && <small style={{ display: "block", marginTop: 3, color: "#87600a" }}>{recipient.rank_name ?? "Starter"} · Level {recipient.level_number ?? 0}</small>}
                </span>
              </label>
            ))}
          </div>
          <small style={{ color: "#667085", lineHeight: 1.5 }}>Showing all accounts that match your search and filters. Select up to 1,000 recipients per send. Emails are delivered individually.</small>
        </section>

        <section className="adminPanel" style={{ display: "grid", gap: 15 }}>
          <div>
            <label htmlFor="email-subject" style={labelStyle}>Subject</label>
            <input id="email-subject" style={inputStyle} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" />
          </div>
          <div>
            <label htmlFor="email-message" style={labelStyle}>Message</label>
            <textarea id="email-message" style={{ ...inputStyle, minHeight: 250, resize: "vertical", lineHeight: 1.6 }} maxLength={12000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message…" />
            <small style={{ display: "block", marginTop: 5, color: "#667085", textAlign: "right" }}>{message.length.toLocaleString()}/12,000</small>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid #eef0f3", paddingTop: 14 }}>
            <span style={{ color: "#667085", fontSize: 13 }}>{selectedRecipients.length} recipient{selectedRecipients.length === 1 ? "" : "s"} selected</span>
            <button type="button" onClick={sendMessage} disabled={sending || deliveryConfigured === false || !selected.length || !subject.trim() || !message.trim()} style={{ border: 0, borderRadius: 9, padding: "11px 17px", background: "#1AEF22", color: "#111", fontWeight: 800, cursor: "pointer", opacity: sending || deliveryConfigured === false || !selected.length || !subject.trim() || !message.trim() ? 0.55 : 1 }}>
              {sending ? "Sending…" : `Send to ${selected.length || "…"}`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, color: "#475467", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 };
const textButtonStyle: React.CSSProperties = { border: 0, background: "transparent", color: "#166534", fontSize: 12, fontWeight: 800, cursor: "pointer" };
