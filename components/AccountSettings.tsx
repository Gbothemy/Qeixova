"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BankAccountsModal from "@/components/BankAccountsModal";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/useAuth";

type AccountProfile = { full_name: string; email: string; phone: string; bio: string; website: string | null; location: string | null; occupation: string | null };
type Action = "profile" | "password" | "notifications" | "bank" | "bank-modal" | "terms" | "privacy" | "support" | null;
type Preferences = { task_alerts: boolean; reward_updates: boolean; referral_alerts: boolean; weekly_summary: boolean };
type Category = { id: string; label: string; description: string; options: { title: string; detail: string; icon?: string; action?: Action; href?: string }[] };

const categories: Category[] = [
  { id: "account", label: "Your account", description: "See information about your account, manage your profile, and review account access options.", options: [
    { title: "Account information", detail: "See your name, phone number, and email address.", icon: "/icon-profile.svg", action: "profile" },
    { title: "Bank accounts", detail: "Manage where your withdrawals are sent.", icon: "/icon-bank.svg", action: "bank" },
    { title: "Terms of service", detail: "Read the terms for using Qeixova.", icon: "/icon-terms.svg", action: "terms" },
  ] },
  { id: "monetization", label: "Monetization", description: "Manage your QLT earnings and withdrawal details.", options: [
    { title: "Wallet and earnings", detail: "Review your QLT balance, transactions, and withdrawals.", icon: "/icon-wallet.svg", href: "/wallet" },
    { title: "Bank accounts", detail: "Manage your withdrawal destination.", icon: "/icon-bank.svg", action: "bank" },
  ] },
  { id: "premium", label: "Premium", description: "Explore contributor benefits and account upgrades.", options: [
    { title: "Contributor benefits", detail: "Explore ways to grow your profile and participation.", icon: "/icon-creator.svg", href: "/growth" },
  ] },
  { id: "security", label: "Security and account access", description: "Keep your account secure and manage sign-in details.", options: [
    { title: "Change your password", detail: "Change your password at any time.", icon: "/icon-password.svg", action: "password" },
  ] },
  { id: "privacy", label: "Privacy and safety", description: "Review how Qeixova handles your account information.", options: [
    { title: "Privacy policy", detail: "Learn how your information is collected and used.", icon: "/icon-terms.svg", action: "privacy" },
    { title: "Terms of service", detail: "Read the rules and terms for the platform.", icon: "/icon-terms.svg", action: "terms" },
  ] },
  { id: "notifications", label: "Notifications", description: "Choose which activity and account updates you receive.", options: [
    { title: "Notification preferences", detail: "Manage task alerts, rewards, referrals, and summaries.", icon: "/icon-notifications.svg", action: "notifications" },
  ] },
  { id: "accessibility", label: "Accessibility, display, and languages", description: "Adjust how Qeixova looks and feels on this device.", options: [
    { title: "Display preferences", detail: "Change the appearance of the app.", icon: "/icon-settings.svg", href: "#display" },
  ] },
  { id: "resources", label: "Additional resources", description: "Find useful places across your Qeixova account.", options: [
    { title: "Your profile", detail: "View your public contributor profile.", icon: "/icon-profile.svg", href: "/profile" },
    { title: "Messages", detail: "Continue a conversation with another contributor.", icon: "/icon-chat.svg", href: "/messages" },
  ] },
  { id: "help", label: "Help Center", description: "Get help from the Qeixova support team.", options: [
    { title: "Contact support", detail: "Send a question to the Qeixova team.", icon: "/icon-support.svg", action: "support" },
  ] },
];

const preferences: { key: keyof Preferences; label: string; detail: string }[] = [
  { key: "task_alerts", label: "New task alerts", detail: "When new tasks are available" },
  { key: "reward_updates", label: "Reward updates", detail: "When you earn rewards" },
  { key: "referral_alerts", label: "Referral alerts", detail: "When someone joins using your code" },
  { key: "weekly_summary", label: "Weekly summary", detail: "A weekly activity and earnings recap" },
];

export default function AccountSettings() {
  const router = useRouter();
  const { logout } = useAuth();
  const [categoryId, setCategoryId] = useState("account");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [prefs, setPrefs] = useState<Preferences>({ task_alerts: true, reward_updates: true, referral_alerts: true, weekly_summary: false });
  const category = categories.find(item => item.id === categoryId) ?? categories[0];
  const filteredCategories = useMemo(() => categories.filter(item => `${item.label} ${item.description} ${item.options.map(option => option.title).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  useEffect(() => {
    if (action !== "profile") return;
    setLoadingProfile(true); setError("");
    fetch("/api/profile", { cache: "no-store" }).then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.profile) setProfile(data.profile); else setError("Your account information could not load."); })
      .catch(() => setError("Your account information could not load."))
      .finally(() => setLoadingProfile(false));
  }, [action]);

  useEffect(() => {
    if (action !== "notifications") return;
    setLoadingPreferences(true);
    fetch("/api/notifications", { cache: "no-store" }).then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.prefs) setPrefs(data.prefs); else setError("Notification preferences could not load."); })
      .catch(() => setError("Notification preferences could not load."))
      .finally(() => setLoadingPreferences(false));
  }, [action]);

  const chooseCategory = (id: string) => { setCategoryId(id); setAction(null); setError(""); setNotice(""); };
  const chooseAction = (selected: Action) => { setAction(selected); setError(""); setNotice(""); };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!profile) return;
    setSaving(true); setError("");
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_profile", full_name: profile.full_name, phone: profile.phone, bio: profile.bio, website: profile.website || "", location: profile.location || "", occupation: profile.occupation || "" }) }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setSaving(false); if (!response?.ok) { setError(data.error || "Account information could not be saved."); return; }
    setNotice("Account information saved.");
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    if (password.next !== password.confirm) { setError("The new passwords do not match."); return; }
    if (password.next.length < 6) { setError("Your new password must contain at least 6 characters."); return; }
    setSaving(true);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change_password", current_password: password.current, new_password: password.next }) }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setSaving(false); if (!response?.ok) { setError(data.error || "Your password could not be changed."); return; }
    setPassword({ current: "", next: "", confirm: "" }); setNotice("Password changed successfully.");
  };

  const savePreferences = async () => {
    setSaving(true); setError("");
    const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefs }) }).catch(() => null);
    setSaving(false); if (!response?.ok) { setError("Your notification preferences could not be saved."); return; }
    setNotice("Notification preferences saved.");
  };

  const actionPanel = () => {
    if (action === "profile") return <div className="settingsFormPanel"><h3>Account information</h3><p className="panelIntro">Update the details connected to your Qeixova account.</p>{loadingProfile ? <p>Loading your details…</p> : profile ? <form onSubmit={saveProfile}><label>Full name<input required value={profile.full_name} onChange={event => setProfile({ ...profile, full_name: event.target.value })} /></label><label>Email address<input value={profile.email} disabled /></label><label>Phone number<input value={profile.phone || ""} onChange={event => setProfile({ ...profile, phone: event.target.value })} /></label><label>Bio<textarea maxLength={280} value={profile.bio || ""} onChange={event => setProfile({ ...profile, bio: event.target.value })} /><small>{(profile.bio || "").length}/280</small></label><label>Occupation<input value={profile.occupation || ""} onChange={event => setProfile({ ...profile, occupation: event.target.value })} /></label><label>Website<input value={profile.website || ""} onChange={event => setProfile({ ...profile, website: event.target.value })} /></label><label>Location<input value={profile.location || ""} onChange={event => setProfile({ ...profile, location: event.target.value })} /></label><button className="settingsPrimary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></form> : null}</div>;
    if (action === "password") return <div className="settingsFormPanel"><h3>Change your password</h3><p className="panelIntro">Choose a strong password you do not use on other sites.</p><form onSubmit={savePassword}><label>Current password<input type="password" autoComplete="current-password" value={password.current} onChange={event => setPassword({ ...password, current: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" value={password.next} onChange={event => setPassword({ ...password, next: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={password.confirm} onChange={event => setPassword({ ...password, confirm: event.target.value })} required /></label><button className="settingsPrimary" disabled={saving}>{saving ? "Updating…" : "Update password"}</button></form></div>;
    if (action === "notifications") return <div className="settingsFormPanel"><h3>Notification preferences</h3><p className="panelIntro">Choose the updates you would like to receive.</p>{loadingPreferences ? <p className="panelIntro">Loading your preferences…</p> : <><div className="preferenceList">{preferences.map(item => <label className="preferenceRow" key={item.key}><span><strong>{item.label}</strong><small>{item.detail}</small></span><input type="checkbox" checked={prefs[item.key]} onChange={() => setPrefs(current => ({ ...current, [item.key]: !current[item.key] }))} /></label>)}</div><button className="settingsPrimary" type="button" disabled={saving} onClick={() => void savePreferences()}>{saving ? "Saving…" : "Save preferences"}</button></>}</div>;
    if (action === "bank") return <div className="settingsPrompt"><h3>Bank accounts</h3><p className="panelIntro">Manage the bank account used for withdrawals.</p><button type="button" className="settingsPrimary" onClick={() => setAction("bank-modal")}>Open bank accounts</button></div>;
    if (action === "terms" || action === "privacy") return <div className="settingsPrompt"><h3>{action === "terms" ? "Terms of service" : "Privacy policy"}</h3><p className="panelIntro">{action === "terms" ? "Review the terms that apply when you use Qeixova." : "Learn how Qeixova handles account information."}</p><Link className="settingsPrimary" href={action === "terms" ? "/terms" : "/privacy"}>Read {action === "terms" ? "terms of service" : "privacy policy"} <span>↗</span></Link></div>;
    if (action === "support") return <div className="settingsPrompt"><h3>Contact support</h3><p className="panelIntro">Send your question to the Qeixova team.</p><a className="settingsPrimary" href="mailto:qeixova@gmail.com?subject=Qeixova%20Support">Email qeixova@gmail.com ↗</a></div>;
    return null;
  };

  return (
    <main className="page-body settingsPage">
      <aside className="settingsCategories">
        <h1>Settings</h1>
        <label className="settingsSearch"><span aria-hidden="true">⌕</span><input aria-label="Search settings" placeholder="Search Settings" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <nav aria-label="Settings categories">{filteredCategories.map(item => <button key={item.id} type="button" className={categoryId === item.id ? "selected" : ""} onClick={() => chooseCategory(item.id)}>{item.label}<span aria-hidden="true">›</span></button>)}{filteredCategories.length === 0 ? <p className="noResults">No settings found.</p> : null}</nav>
        <button className="logoutRow" type="button" onClick={async () => { await logout(); router.push("/login"); }}>Log out <span aria-hidden="true">↗</span></button>
      </aside>
      <section className="settingsContent" aria-live="polite">
        <div className="settingsContentHeader">{action ? <button type="button" className="backToCategory" onClick={() => chooseAction(null)}>‹ <span>{category.label}</span></button> : null}<h2>{action ? category.options.find(option => option.action === action)?.title ?? category.label : category.label}</h2><p>{action ? "Manage this setting for your account." : category.description}</p></div>
        {action ? <div className="settingsActionContent">{actionPanel()}{error ? <div className="settingsMessage error" role="alert">{error}</div> : null}{notice ? <div className="settingsMessage success" role="status">{notice}</div> : null}</div> : <div className="settingsOptions">{category.options.map((option, index) => {
          const content = <><span className="optionIcon">{option.icon ? <Image src={option.icon} alt="" width={21} height={21} /> : null}</span><span className="optionCopy"><strong>{option.title}</strong><small>{option.detail}</small></span><span className="optionChevron" aria-hidden="true">{option.href === "#display" ? "⌄" : "›"}</span></>;
          if (option.href && option.href !== "#display") return <Link className="settingsOption" href={option.href} key={`${option.title}-${index}`}>{content}</Link>;
          if (option.href === "#display") return <div className="settingsOption displayOption" key={option.title}>{content}<div className="displayToggle"><span>Switch between light and dark appearance.</span><ThemeToggle /></div></div>;
          return <button className="settingsOption" type="button" key={`${option.title}-${index}`} onClick={() => chooseAction(option.action ?? null)}>{content}</button>;
        })}</div>}
      </section>
      {action === "bank-modal" ? <BankAccountsModal onClose={() => chooseAction("bank")} /> : null}
      <style jsx>{`
        .settingsPage{display:grid;grid-template-columns:minmax(270px,36%) minmax(0,1fr);width:min(100%,1240px);min-height:calc(100vh - 70px);margin:0 auto;padding:0;color:var(--text);background:var(--bg);border-left:1px solid #e8edf0;border-right:1px solid #e8edf0}.settingsCategories{position:relative;display:flex;flex-direction:column;min-width:0;border-right:1px solid #e8edf0}.settingsCategories h1{padding:12px 20px 21px;font-size:22px;letter-spacing:-.03em}.settingsSearch{display:flex;align-items:center;gap:9px;height:48px;margin:4px 10px 10px;padding:0 15px;border:1px solid #ccd7df;border-radius:999px;color:#536879}.settingsSearch:focus-within{border-color:#2398db;box-shadow:0 0 0 3px #2398db20}.settingsSearch>span{font-size:21px;line-height:1}.settingsSearch input{width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:14px}.settingsSearch input::placeholder{color:#71808d}.settingsCategories nav{display:grid}.settingsCategories nav button,.logoutRow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:0 20px;border:0;background:var(--bg);color:var(--text);text-align:left;font:inherit;font-size:15px;cursor:pointer;transition:background .15s ease}.settingsCategories nav button:hover,.settingsCategories nav button.selected{background:#f1f4f6}.settingsCategories nav button.selected{box-shadow:inset -2px 0 #1596e8;font-weight:650}.settingsCategories nav button span,.logoutRow span{color:#596b79;font-size:25px;font-weight:350}.noResults{padding:16px 20px;color:#71808d;font-size:13px}.logoutRow{margin-top:auto;min-height:54px;border-top:1px solid #edf0f2;color:#b5443d;font-size:13px}.settingsContent{min-width:0;padding:13px 24px 60px}.settingsContentHeader h2{font-size:22px;letter-spacing:-.03em}.settingsContentHeader p{max-width:700px;margin-top:30px;color:#526a7c;font-size:13px;line-height:1.5}.settingsOptions{display:grid;margin-top:22px}.settingsOption{display:flex;align-items:center;gap:20px;width:100%;min-height:90px;padding:14px 8px;border:0;border-bottom:1px solid #e8edf0;background:var(--bg);color:var(--text);text-align:left;text-decoration:none;font:inherit;cursor:pointer;transition:background .15s ease}.settingsOption:first-child{border-top:1px solid #e8edf0}.settingsOption:hover{background:#f7f9fa}.settingsOption:focus-visible,.settingsCategories nav button:focus-visible,.logoutRow:focus-visible{outline:2px solid #168fe0;outline-offset:-2px}.optionIcon{display:grid;place-items:center;flex:0 0 40px;width:40px;color:#526a7c}.optionIcon img{opacity:.78}.optionCopy{display:grid;flex:1;gap:3px}.optionCopy strong{font-size:15px;font-weight:550}.optionCopy small{color:#657b8c;font-size:12px;line-height:1.4}.optionChevron{margin-left:auto;color:#526a7c;font-size:26px;font-weight:300}.displayOption{flex-wrap:wrap}.displayToggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:calc(100% - 60px);margin:0 0 0 60px;color:#526a7c;font-size:12px}.settingsActionContent{max-width:620px;margin-top:18px;padding:20px;border:1px solid #e3e9ed;border-radius:14px;background:color-mix(in srgb,var(--bg) 96%,#e9eff3)}.settingsFormPanel h3,.settingsPrompt h3{font-size:17px}.panelIntro{margin:7px 0 18px;color:#657b8c;font-size:12px;line-height:1.5}.settingsFormPanel form{display:grid;gap:13px}.settingsFormPanel form>label{display:grid;gap:6px;color:#435565;font-size:12px;font-weight:650}.settingsFormPanel input:not([type=checkbox]),.settingsFormPanel textarea{width:100%;padding:11px 12px;border:1px solid #ccd7df;border-radius:8px;background:var(--bg);color:var(--text);font:inherit;font-size:13px;outline:none}.settingsFormPanel textarea{min-height:78px;resize:vertical}.settingsFormPanel input:focus,.settingsFormPanel textarea:focus{border-color:#2398db;box-shadow:0 0 0 3px #2398db20}.settingsFormPanel input:disabled{background:#f5f7f8;color:#71808d}.settingsFormPanel form small{justify-self:end;color:#71808d;font-size:10px}.settingsPrimary{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:max-content;max-width:100%;padding:10px 15px;border:0;border-radius:8px;background:#168fe0;color:white;font:inherit;font-size:12px;font-weight:750;text-decoration:none;cursor:pointer;transition:filter .15s ease,transform .15s ease}.settingsPrimary:hover{filter:brightness(.94);transform:translateY(-1px)}.settingsPrimary:focus-visible{outline:3px solid #168fe055;outline-offset:2px}.settingsPrimary:disabled{opacity:.6}.settingsPrompt>.settingsPrimary{margin-top:5px}.preferenceList{margin:16px 0;border-top:1px solid #e4e9ed}.preferenceRow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 2px;border-bottom:1px solid #e4e9ed;cursor:pointer}.preferenceRow>span{display:grid;gap:4px}.preferenceRow strong{font-size:12px}.preferenceRow small{color:#71808d;font-size:11px}.preferenceRow input{width:17px;height:17px;accent-color:#168fe0}.settingsMessage{margin-top:14px;padding:11px 13px;border-radius:8px;font-size:12px}.settingsMessage.error{background:#fff1ef;color:#a34239}.settingsMessage.success{background:#eef8f0;color:#2d7045}.backToCategory{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:0;border:0;background:none;color:#168fe0;font:inherit;font-size:12px;cursor:pointer}
        @media(max-width:760px){.settingsPage{grid-template-columns:1fr;min-height:0;border:0}.settingsCategories{border-right:0;border-bottom:1px solid #e8edf0}.settingsCategories h1{padding:14px 16px 12px}.settingsSearch{margin-inline:12px}.settingsCategories nav{grid-template-columns:repeat(2,minmax(0,1fr));max-height:210px;overflow:auto}.settingsCategories nav button{min-height:48px;padding-inline:14px;font-size:12px}.settingsCategories nav button.selected{box-shadow:inset 0 -2px #1596e8}.logoutRow{min-height:44px;padding-inline:15px}.settingsContent{padding:20px 16px 80px}.settingsContentHeader h2{font-size:20px}.settingsContentHeader p{margin-top:12px}.settingsOptions{margin-top:12px}.settingsOption{min-height:76px;gap:10px;padding:11px 0}.optionIcon{flex-basis:32px;width:32px}.optionCopy strong{font-size:13px}.optionCopy small{font-size:11px}.displayToggle{margin-left:42px}}
      `}</style>
    </main>
  );
}
