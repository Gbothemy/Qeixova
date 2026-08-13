"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import BankAccountsModal from "@/components/BankAccountsModal";
import ContributorLoading from "@/components/ContributorLoading";
import { useAuth } from "@/lib/useAuth";

interface Profile {
  full_name: string; email: string; phone: string;
  balance: number; streak: number; level: number;
  referral_code: string; tasks_completed: number;
  tasks_today: number; total_earned: number;
  total_withdrawn: number; referral_count: number;
  created_at: string; trust_level: string;
  approved_count: number; rejected_count: number;
  xp?: number; trust_score?: number; level_name?: string;
  badge_color?: string; milestones_claimed?: number;
  total_earned_qlt: number; bonus_earned_qlt: number;
}

type ModalType = "edit" | "password" | "notifications" | "support" | "terms" | null;

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#111111", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520, padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto", border: "1px solid #222222" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 18, color: "#F5F5F5" }}>{title}</p>
          <button onClick={onClose} style={{ background: "#222222", border: "none", borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#F5F5F5" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: "#bbbbbb", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", marginTop: 6, padding: "13px 14px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 15, outline: "none", color: "#F5F5F5", background: "#1a1a1a" }}
        onFocus={e => (e.target.style.borderColor = "#1AEF22")}
        onBlur={e => (e.target.style.borderColor = "#999999")}
      />
    </div>
  );
}

function Alert({ msg }: { msg: { type: "success" | "error"; text: string } }) {
  return (
    <div style={{ background: msg.type === "success" ? "rgba(26,239,34,0.1)" : "rgba(229,62,62,0.1)", border: `1px solid ${msg.type === "success" ? "rgba(26,239,34,0.3)" : "rgba(229,62,62,0.3)"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{msg.type === "success" ? "✅" : "⚠️"}</span>
      <p style={{ color: msg.type === "success" ? "#1AEF22" : "#e53e3e", fontSize: 13, fontWeight: 600 }}>{msg.text}</p>
    </div>
  );
}

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Partial<Profile>) => void; }) {
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_profile", full_name: name, phone }) });
    const data = await res.json();
    if (res.ok) { setMsg({ type: "success", text: "Profile updated!" }); onSaved({ full_name: name, phone }); setTimeout(onClose, 1200); }
    else setMsg({ type: "error", text: data.error || "Failed to update" });
    setSaving(false);
  };

  return (
    <Modal title="Edit Profile" onClose={onClose}>
      {msg && <Alert msg={msg} />}
      <Field label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
      <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+234 800 000 0000" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "#bbbbbb", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Email Address</label>
        <input value={profile.email} disabled style={{ width: "100%", marginTop: 6, padding: "13px 14px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 15, color: "#bbbbbb", background: "#1a1a1a", cursor: "not-allowed" }} />
        <p style={{ fontSize: 11, color: "#bbbbbb", marginTop: 4 }}>Email cannot be changed</p>
      </div>
      <button onClick={save} disabled={saving} style={{ width: "100%", background: saving ? "#999999" : "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 6px 20px rgba(26,239,34,0.3)", marginTop: 4 }}>
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </Modal>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const save = async () => {
    if (next !== confirm) { setMsg({ type: "error", text: "Passwords do not match" }); return; }
    if (next.length < 6) { setMsg({ type: "error", text: "Password must be at least 6 characters" }); return; }
    setSaving(true); setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change_password", current_password: current, new_password: next }) });
    const data = await res.json();
    if (res.ok) { setMsg({ type: "success", text: "Password changed!" }); setTimeout(onClose, 1400); }
    else setMsg({ type: "error", text: data.error || "Failed to change password" });
    setSaving(false);
  };

  return (
    <Modal title="Change Password" onClose={onClose}>
      {msg && <Alert msg={msg} />}
      <Field label="Current Password" type="password" value={current} onChange={setCurrent} placeholder="Enter current password" />
      <Field label="New Password" type="password" value={next} onChange={setNext} placeholder="At least 6 characters" />
      <Field label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat new password" />
      <button onClick={save} disabled={saving} style={{ width: "100%", background: saving ? "#999999" : "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 6px 20px rgba(26,239,34,0.3)", marginTop: 4 }}>
        {saving ? "Updating..." : "Update Password"}
      </button>
    </Modal>
  );
}

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState({ task_alerts: true, reward_updates: true, referral_alerts: true, weekly_summary: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    fetch("/api/notifications").then(r => r.ok ? r.json() : null).then(d => { if (d?.prefs) setPrefs(d.prefs); }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefs }) });
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  const items = [
    { key: "task_alerts" as const, label: "New Task Alerts", sub: "Get notified when new tasks are available" },
    { key: "reward_updates" as const, label: "Reward Updates", sub: "Notifications when you earn rewards" },
    { key: "referral_alerts" as const, label: "Referral Alerts", sub: "When someone joins using your code" },
    { key: "weekly_summary" as const, label: "Weekly Summary", sub: "Your weekly earnings and activity report" },
  ];

  return (
    <Modal title="Notifications" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map(item => (
          <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #222222" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F5" }}>{item.label}</p>
              <p style={{ fontSize: 12, color: "#bbbbbb", marginTop: 2 }}>{item.sub}</p>
            </div>
            <div onClick={() => toggle(item.key)} style={{ width: 46, height: 26, borderRadius: 13, cursor: "pointer", transition: "background 0.2s", background: prefs[item.key] ? "#1AEF22" : "#999999", position: "relative" }}>
              <div style={{ position: "absolute", top: 3, left: prefs[item.key] ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ width: "100%", background: saved ? "#1AEF22" : saving ? "#999999" : "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 6px 20px rgba(26,239,34,0.3)", marginTop: 20 }}>
        {saved ? "✅ Saved!" : saving ? "Saving..." : "Save Preferences"}
      </button>
    </Modal>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const send = () => {
    if (!subject.trim() || !message.trim()) return;
    window.open(`mailto:qeixova@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Subject: ${subject}\n\n${message}`)}`, "_blank");
    setSent(true);
  };

  if (sent) return (
    <Modal title="Support" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <p style={{ fontWeight: 800, fontSize: 18, color: "#F5F5F5", marginBottom: 8 }}>Message Sent!</p>
        <p style={{ color: "#bbbbbb", fontSize: 14 }}>Our support team will get back to you within 24 hours.</p>
        <button onClick={onClose} style={{ marginTop: 24, background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 14, padding: "14px 32px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Done</button>
      </div>
    </Modal>
  );

  return (
    <Modal title="Contact Support" onClose={onClose}>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "📧", label: "Email", sub: "qeixova@gmail.com", href: "mailto:qeixova@gmail.com" },
          { icon: "📘", label: "Facebook", sub: "Message us", href: "https://www.facebook.com/profile.php?id=61568026449468" },
          { icon: "🐦", label: "Twitter/X", sub: "@QeixovaTech", href: "https://x.com/QeixovaTech" },
        ].map(c => (
          <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333333", borderRadius: 14, padding: "12px 8px", textAlign: "center", textDecoration: "none" }}>
            <p style={{ fontSize: 22 }}>{c.icon}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#F5F5F5", marginTop: 4 }}>{c.label}</p>
            <p style={{ fontSize: 10, color: "#bbbbbb" }}>{c.sub}</p>
          </a>
        ))}
      </div>
      <Field label="Subject" value={subject} onChange={setSubject} placeholder="What do you need help with?" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "#bbbbbb", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue in detail..." rows={4}
          style={{ width: "100%", marginTop: 6, padding: "13px 14px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 14, outline: "none", color: "#F5F5F5", background: "#1a1a1a", resize: "none" }}
          onFocus={e => (e.target.style.borderColor = "#1AEF22")} onBlur={e => (e.target.style.borderColor = "#999999")} />
      </div>
      <button onClick={send} style={{ width: "100%", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 20px rgba(26,239,34,0.3)" }}>Send Message</button>
    </Modal>
  );
}

function TermsModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<"menu" | "terms" | "privacy" | "refund">("menu");
  const content: Record<string, { title: string; body: string }> = {
    terms: { title: "Terms of Service", body: `Welcome to Qeixova. By using our platform you agree to these terms.\n\n1. ELIGIBILITY\nYou must be at least 18 years old and a resident of Nigeria.\n\n2. EARNING & REWARDS\n100 QLT = ₦1. Points have no cash value until converted via withdrawal.\n\n3. TASK COMPLETION\nComplete tasks honestly. Fraudulent submissions result in account suspension.\n\n4. WITHDRAWALS\nMinimum withdrawal is 100,000 QLT (₦1,000). Processed within 24 hours.\n\n5. REFERRALS\nYou earn 2,500 QLT per referral signup plus 10% of their task earnings. Referral abuse results in termination.\n\n6. CHANGES\nWe may update these terms at any time.` },
    privacy: { title: "Privacy Policy", body: `Qeixova is committed to protecting your personal information.\n\n1. DATA WE COLLECT\nName, email, phone number, and task completion data.\n\n2. HOW WE USE YOUR DATA\nTo manage your account and process withdrawals. We do not sell your data.\n\n3. DATA SECURITY\nAll data is encrypted. Passwords are hashed using bcrypt.\n\n4. YOUR RIGHTS\nRequest deletion by contacting qeixova@gmail.com.` },
    refund: { title: "Refund Policy", body: `Qeixova does not charge users any fees.\n\n1. NO DEPOSITS\nQeixova does not require any deposits or payments.\n\n2. WITHDRAWAL DISPUTES\nIf a withdrawal is not received within 48 hours, contact support.\n\n3. POINT DISPUTES\nContact support within 7 days of the transaction.` },
  };

  if (view !== "menu") {
    const c = content[view];
    return (
      <Modal title={c.title} onClose={onClose}>
        <button onClick={() => setView("menu")} style={{ background: "#222222", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, cursor: "pointer", marginBottom: 16, color: "#F5F5F5", fontWeight: 600 }}>← Back</button>
        <div style={{ fontSize: 13, color: "#aaaaaa", lineHeight: 1.8, whiteSpace: "pre-line" }}>{c.body}</div>
      </Modal>
    );
  }

  return (
    <Modal title="Terms & Privacy" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { key: "terms", icon: "📋", title: "Terms of Service", sub: "Rules and guidelines for using Qeixova" },
          { key: "privacy", icon: "🔒", title: "Privacy Policy", sub: "How we collect and use your data" },
          { key: "refund", icon: "💰", title: "Refund Policy", sub: "Our policy on disputes and withdrawals" },
        ].map(item => (
          <div key={item.key} onClick={() => setView(item.key as "terms" | "privacy" | "refund")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#1a1a1a", borderRadius: 14, border: "1px solid #333333", cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(26,239,34,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F5" }}>{item.title}</p>
              <p style={{ fontSize: 12, color: "#bbbbbb", marginTop: 2 }}>{item.sub}</p>
            </div>
            <span style={{ color: "#bbbbbb", fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", color: "#aaaaaa", fontSize: 12, marginTop: 20 }}>Last updated: April 2025 · Qeixova v1.0</p>
    </Modal>
  );
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [copied, setCopied] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => {
    fetch("/api/profile").then(r => r.ok ? r.json() : null).then(d => { if (d?.profile) setProfile(d.profile); }).catch(() => {});
  }, []);

  const copyCode = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.referral_code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const patchProfile = (updates: Partial<Profile>) => setProfile(p => p ? { ...p, ...updates } : p);

  const stats = profile ? [
    { label: "Tasks Today",    value: String(profile.tasks_today),    icon: "/icon-task.svg" },
    { label: "Approved Tasks", value: String(profile.tasks_completed), icon: "/icon-task.svg" },
    { label: "Mission QLT",    value: `${Number(profile.total_earned_qlt ?? 0).toLocaleString()} QLT`, icon: "/icon-wallet.svg" },
    { label: "Bonus QLT",      value: `${Number(profile.bonus_earned_qlt ?? 0).toLocaleString()} QLT`, icon: "/icon-wallet.svg" },
    { label: "Total Earned",   value: profile.total_earned >= 1000 ? `${(profile.total_earned / 1000).toFixed(0)}k QLT` : `${profile.total_earned} QLT`, icon: "/icon-wallet.svg" },
    { label: "Withdrawn",      value: profile.total_withdrawn >= 1000 ? `${(profile.total_withdrawn / 1000).toFixed(0)}k QLT` : `${profile.total_withdrawn} QLT`, icon: "/icon-wallet.svg" },
    { label: "Balance",        value: `${profile.balance.toLocaleString()} QLT`, icon: "/icon-wallet.svg" },
    { label: "Referrals",      value: String(profile.referral_count), icon: "/icon-profile.svg" },
  ] : [];

  const menuItems = [
    { icon: "/icon-bank.svg",          label: "Bank Accounts",   sub: "Add & manage withdrawal accounts",  action: () => setShowBankModal(true) },
    { icon: "/icon-edit-profile.svg",  label: "Edit Profile",    sub: "Update your name & phone",           action: () => setModal("edit") },
    { icon: "/icon-password.svg",      label: "Change Password", sub: "Update your account password",       action: () => setModal("password") },
    { icon: "/icon-notifications.svg", label: "Notifications",   sub: "Task alerts & updates",              action: () => setModal("notifications") },
    { icon: "/icon-support.svg",       label: "Support",         sub: "Get help anytime",                   action: () => setModal("support") },
    { icon: "/icon-terms.svg",         label: "Terms & Privacy", sub: "Legal information",                  action: () => setModal("terms") },
  ];

  if (!profile) return <ContributorLoading label="Loading profile" detail="Preparing your account, progress, and preferences." />;

  return (
    <div className="page-body" style={{ background: "#000000", minHeight: "100vh" }}>
      {/* Header */}
      <div className="page-header" style={{ background: "#0a0a0a", borderBottom: "1px solid #222222", padding: "52px 20px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(26,239,34,0.03)" }} />
        <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #F5A623, #d89420)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 6px 20px rgba(245,166,35,0.4)", border: "3px solid #1a1a1a" }}>
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "👤"}
          </div>
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: "50%", background: "#1AEF22", border: "2px solid #0a0a0a" }} />
        </div>
        <p style={{ color: "#F5F5F5", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{profile?.full_name ?? "Loading..."}</p>
        <p style={{ color: "#cccccc", fontSize: 13, marginTop: 3 }}>{profile?.email}</p>
        {profile?.phone && <p style={{ color: "#cccccc", fontSize: 12, marginTop: 2 }}>{profile.phone}</p>}
        {profile?.created_at && <p style={{ color: "#bbbbbb", fontSize: 11, marginTop: 4 }}>Member since {timeAgo(profile.created_at)}</p>}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: (profile?.badge_color ?? "#ccc") + "22", border: `1px solid ${profile?.badge_color ?? "#ccc"}44`, borderRadius: 20, padding: "6px 16px" }}>
            <span style={{ color: profile?.badge_color ?? "#ccc", fontSize: 12, fontWeight: 700 }}>L{profile?.level ?? 1} {profile?.level_name ?? "Starter"}</span>
          </div>
          {profile?.xp !== undefined && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 20, padding: "5px 14px" }}>
              <span style={{ color: "#F5A623", fontSize: 12, fontWeight: 700 }}>{profile.xp.toLocaleString()} QLT progress</span>
            </div>
          )}
          {profile && profile.streak > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(26,239,34,0.08)", border: "1px solid rgba(26,239,34,0.2)", borderRadius: 20, padding: "5px 14px" }}>
              <span style={{ color: "#1AEF22", fontSize: 12, fontWeight: 600 }}>🔥 {profile.streak}-day streak</span>
            </div>
          )}
          {profile?.trust_score !== undefined && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: profile.trust_score >= 80 ? "rgba(26,239,34,0.08)" : profile.trust_score >= 50 ? "rgba(245,166,35,0.08)" : "rgba(229,62,62,0.08)", border: `1px solid ${profile.trust_score >= 80 ? "rgba(26,239,34,0.2)" : profile.trust_score >= 50 ? "rgba(245,166,35,0.2)" : "rgba(229,62,62,0.2)"}`, borderRadius: 20, padding: "5px 14px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: profile.trust_score >= 80 ? "#1AEF22" : profile.trust_score >= 50 ? "#F5A623" : "#e53e3e" }}>
                Trust: {profile.trust_score}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: "0 16px", marginTop: -24 }}>
        <div style={{ background: "#111111", borderRadius: 20, padding: "20px", border: "1px solid #222222", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "12px 8px", borderRight: i % 2 === 0 ? "1px solid #222222" : "none", borderBottom: i < stats.length - 2 ? "1px solid #222222" : "none" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                <Image src={s.icon} alt={s.label} width={20} height={20} style={{ objectFit: "contain", opacity: 0.7 }} />
              </div>
              <p style={{ fontWeight: 800, fontSize: 15, color: "#1AEF22" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "#bbbbbb", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Approval Feedback */}
      {profile && (profile.approved_count > 0 || profile.rejected_count > 0) && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ background: "#111111", borderRadius: 16, padding: "16px 18px", border: "1px solid #222222" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#F5F5F5", marginBottom: 12 }}>Task Review Summary</p>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, background: "rgba(26,239,34,0.06)", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid rgba(26,239,34,0.15)" }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#1AEF22" }}>{profile.approved_count}</p>
                <p style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>Approved</p>
              </div>
              <div style={{ flex: 1, background: "rgba(229,62,62,0.06)", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid rgba(229,62,62,0.15)" }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#e53e3e" }}>{profile.rejected_count}</p>
                <p style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>Rejected</p>
              </div>
              <div style={{ flex: 1, background: "rgba(245,166,35,0.06)", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid rgba(245,166,35,0.15)" }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#F5A623" }}>
                  {profile.approved_count + profile.rejected_count > 0
                    ? Math.round((profile.approved_count / (profile.approved_count + profile.rejected_count)) * 100)
                    : 0}%
                </p>
                <p style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>Success Rate</p>
              </div>
            </div>
            {profile.trust_level === "new" && profile.approved_count < 5 && (
              <p style={{ fontSize: 11, color: "#cccccc", marginTop: 10, textAlign: "center" }}>
                Complete {5 - profile.approved_count} more approved task{5 - profile.approved_count !== 1 ? "s" : ""} to become a Trusted User
              </p>
            )}
            {profile.trust_level === "flagged" && (
              <p style={{ fontSize: 11, color: "#e53e3e", marginTop: 10, textAlign: "center" }}>
                Your account has been flagged due to high rejection rate. Please review task requirements carefully.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Referral banner */}
      {profile && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ background: "linear-gradient(135deg, #F5A623 0%, #d89420 100%)", borderRadius: 18, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 6px 20px rgba(245,166,35,0.3)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(0,0,0,0.08)" }} />
            <div>
              <p style={{ color: "#000", fontWeight: 800, fontSize: 16 }}>Refer & Earn 2,500 QLT + 10%</p>
              <p style={{ color: "rgba(0,0,0,0.65)", fontSize: 12, marginTop: 3 }}>Your code: <span style={{ fontWeight: 800, letterSpacing: 1 }}>{profile.referral_code}</span></p>
              <p style={{ color: "rgba(0,0,0,0.5)", fontSize: 11, marginTop: 2 }}>{profile.referral_count} {profile.referral_count === 1 ? "person" : "people"} joined • Earn 10% of their earnings</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyCode} style={{ background: "#000", color: "#F5A623", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                {copied ? "Copied! ✅" : "Copy 📋"}
              </button>
              <button onClick={() => {
                const url = `${window.location.origin}/register?ref=${profile.referral_code}`;
                if (navigator.share) {
                  navigator.share({ title: "Join Qeixova", text: "Earn QLT by completing missions!", url });
                } else {
                  navigator.clipboard.writeText(url);
                  setCopied(true); setTimeout(() => setCopied(false), 2000);
                }
              }} style={{ background: "rgba(0,0,0,0.15)", color: "#000", border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Share 🔗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ background: "#111111", borderRadius: 20, overflow: "hidden", border: "1px solid #222222" }}>
          {menuItems.map((item, i) => (
            <div key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: i < menuItems.length - 1 ? "1px solid #1a1a1a" : "none", cursor: "pointer" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(26,239,34,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Image src={item.icon} alt={item.label} width={22} height={22} style={{ objectFit: "contain" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F5" }}>{item.label}</p>
                <p style={{ fontSize: 12, color: "#bbbbbb", marginTop: 1 }}>{item.sub}</p>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbbbbb", fontSize: 16 }}>›</div>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: "16px 16px 0" }}>
        <button onClick={logout} style={{ width: "100%", background: "rgba(229,62,62,0.08)", color: "#e53e3e", border: "1.5px solid rgba(229,62,62,0.2)", borderRadius: 16, padding: "15px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          🚪 Log Out
        </button>
      </div>

      <BottomNav />
      {showBankModal && <BankAccountsModal onClose={() => setShowBankModal(false)} />}
      {modal === "edit" && profile && <EditProfileModal profile={profile} onClose={() => setModal(null)} onSaved={patchProfile} />}
      {modal === "password" && <ChangePasswordModal onClose={() => setModal(null)} />}
      {modal === "notifications" && <NotificationsModal onClose={() => setModal(null)} />}
      {modal === "support" && <SupportModal onClose={() => setModal(null)} />}
      {modal === "terms" && <TermsModal onClose={() => setModal(null)} />}
    </div>
  );
}
