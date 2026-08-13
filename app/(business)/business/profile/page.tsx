"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessBottomNav from "@/components/BusinessBottomNav";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";
import { INTEREST_OPTIONS } from "@/lib/interestTaxonomy";

type BusinessProfile = {
  description?: string;
  campaignGoals?: string[];
  campaignCategories?: string[];
  preferredPlatforms?: string[];
  targetInterests?: string[];
  alertPreferences?: string[];
  location?: { country?: string; state?: string; city?: string };
};

type Business = {
  id: number;
  name: string;
  email: string;
  industry?: string | null;
  website?: string | null;
  balance: number;
  status?: string | null;
  onboarding_completed?: boolean;
  profile?: BusinessProfile;
};

type FormState = {
  name: string;
  industry: string;
  website: string;
  description: string;
  country: string;
  state: string;
  city: string;
  campaignGoals: string[];
  campaignCategories: string[];
  preferredPlatforms: string[];
  targetInterests: string[];
  alertPreferences: string[];
};

const campaignGoalOptions = ["Brand awareness", "Event awareness", "Product promotion", "Creator content promotion", "Local visibility", "New song awareness", "Increase members", "App testing", "Product feedback", "Market research"];
const categoryOptions = ["Content Distribution", "Music Promotion", "Community Growth", "App Testing", "Feedback Campaign"];
const platformOptions = ["WhatsApp", "Instagram", "Facebook", "TikTok", "X (Twitter)", "Telegram", "YouTube", "App stores", "Website"];
const interestOptions = [...INTEREST_OPTIONS];
const alertOptions = ["Campaign approval", "Contributor proof submitted", "Wallet and funding updates", "Unread alert details", "Campaign rejection", "Budget reserved"];

function makeForm(business: Business): FormState {
  const profile = business.profile ?? {};
  return {
    name: business.name ?? "",
    industry: business.industry ?? "",
    website: business.website ?? "",
    description: profile.description ?? "",
    country: profile.location?.country ?? "Nigeria",
    state: profile.location?.state ?? "",
    city: profile.location?.city ?? "",
    campaignGoals: profile.campaignGoals ?? [],
    campaignCategories: profile.campaignCategories ?? [],
    preferredPlatforms: profile.preferredPlatforms ?? [],
    targetInterests: profile.targetInterests ?? [],
    alertPreferences: profile.alertPreferences ?? [],
  };
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function summarize(values: string[], empty = "Not set") {
  if (values.length === 0) return empty;
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
}

export default function BusinessProfilePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/business/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          router.push("/business/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.business) {
          setBusiness(data.business);
          setForm(makeForm(data.business));
        }
      })
      .catch(() => router.push("/business/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const completion = useMemo(() => {
    if (!form) return 0;
    const checks = [
      form.name.trim().length >= 2,
      form.industry.trim().length > 0,
      form.website.trim().length > 0,
      form.description.trim().length >= 20,
      form.state.trim().length > 0 || form.city.trim().length > 0,
      form.campaignGoals.length > 0,
      form.preferredPlatforms.length > 0,
      form.alertPreferences.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const updateForm = (updates: Partial<FormState>) => {
    setForm((current) => current ? { ...current, ...updates } : current);
    setNotice(null);
  };

  const updateList = (field: keyof Pick<FormState, "campaignGoals" | "campaignCategories" | "preferredPlatforms" | "targetInterests" | "alertPreferences">, value: string) => {
    setForm((current) => current ? { ...current, [field]: toggleValue(current[field], value) } : current);
    setNotice(null);
  };

  const saveProfile = async () => {
    if (!form) return;
    if (form.name.trim().length < 2) {
      setNotice({ type: "error", text: "Enter a valid business name before saving." });
      return;
    }

    setSaving(true);
    const res = await fetch("/api/business/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        industry: form.industry,
        website: form.website,
        profile: {
          description: form.description,
          campaignGoals: form.campaignGoals,
          campaignCategories: form.campaignCategories,
          preferredPlatforms: form.preferredPlatforms,
          targetInterests: form.targetInterests,
          alertPreferences: form.alertPreferences,
          location: { country: form.country, state: form.state, city: form.city },
        },
      }),
    }).catch(() => null);

    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) {
      setNotice({ type: "error", text: data?.error || "Profile could not be saved." });
      return;
    }
    setBusiness(data.business);
    setForm(makeForm(data.business));
    setNotice({ type: "success", text: "Profile changes saved." });
  };

  const logout = async () => {
    await fetch("/api/business/logout", { method: "POST" });
    router.push("/business/login");
  };

  if (loading || !business || !form) {
    return <BusinessLoading title="Loading business profile" detail="Preparing account settings and preferences." />;
  }

  return (
    <>
      <main className="profileShell">
        <BusinessSidebar name={business.name} />
        <section className="profileMain">
          <header className="settingsHeader">
            <div>
              <p>Settings</p>
              <h1>Business profile</h1>
              <span>Manage the account details and defaults used across campaign creation.</span>
            </div>
            <div className="profileCompletion">
              <span>Profile completion</span>
              <strong>{completion}%</strong>
              <i><b style={{ width: `${completion}%` }} /></i>
            </div>
          </header>

          <section className="settingsLayout">
            <aside className="settingsRail">
              <div className="railIdentity">
                <div className="accountMark">{form.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{form.name || "Business account"}</strong>
                  <span>{business.email}</span>
                </div>
              </div>
              <nav aria-label="Profile sections">
                <a href="#business-info">Business information</a>
                <a href="#location">Location</a>
                <a href="#preferences">Campaign preferences</a>
                <a href="#alerts">Alerts</a>
              </nav>
              <dl>
                <div><dt>Balance</dt><dd>{Number(business.balance ?? 0).toLocaleString()} QLT</dd></div>
                <div><dt>Status</dt><dd>{business.status || "Active"}</dd></div>
                <div><dt>Location</dt><dd>{[form.city, form.state, form.country].filter(Boolean).join(", ") || "Not set"}</dd></div>
              </dl>
              <button type="button" onClick={() => router.push("/business/tasks/new")}>Create campaign</button>
            </aside>

            <form className="settingsEditor" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
              <SettingsPanel id="business-info" title="Business information" note="Core details used for account review, campaign approvals, and support.">
                <div className="fieldGrid">
                  <Field label="Business name" value={form.name} onChange={(value) => updateForm({ name: value })} placeholder="Business name" />
                  <Field label="Industry" value={form.industry} onChange={(value) => updateForm({ industry: value })} placeholder="Music, food, technology..." />
                  <Field label="Website or social link" value={form.website} onChange={(value) => updateForm({ website: value })} placeholder="https://example.com" />
                  <label className="formField wide">
                    <span>Business description</span>
                    <textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} rows={5} placeholder="Briefly describe your business and the campaigns you usually run." />
                  </label>
                </div>
              </SettingsPanel>

              <SettingsPanel id="location" title="Location" note="Default market information for campaign targeting.">
                <div className="fieldGrid">
                  <Field label="Country" value={form.country} onChange={(value) => updateForm({ country: value })} placeholder="Nigeria" />
                  <Field label="State or region" value={form.state} onChange={(value) => updateForm({ state: value })} placeholder="Lagos" />
                  <Field label="City or area" value={form.city} onChange={(value) => updateForm({ city: value })} placeholder="Ikeja" />
                </div>
              </SettingsPanel>

              <SettingsPanel id="preferences" title="Campaign preferences" note="Open each dropdown to choose account defaults for new campaigns.">
                <div className="dropdownGrid">
                  <MultiSelect label="Goals" options={campaignGoalOptions} selected={form.campaignGoals} onToggle={(value) => updateList("campaignGoals", value)} />
                  <MultiSelect label="Campaign types" options={categoryOptions} selected={form.campaignCategories} onToggle={(value) => updateList("campaignCategories", value)} />
                  <MultiSelect label="Preferred platforms" options={platformOptions} selected={form.preferredPlatforms} onToggle={(value) => updateList("preferredPlatforms", value)} />
                  <MultiSelect label="Audience interests" options={interestOptions} selected={form.targetInterests} onToggle={(value) => updateList("targetInterests", value)} />
                </div>
              </SettingsPanel>

              <SettingsPanel id="alerts" title="Alerts" note="Choose which business notifications should stay prominent.">
                <div className="dropdownGrid single">
                  <MultiSelect label="Alert types" options={alertOptions} selected={form.alertPreferences} onToggle={(value) => updateList("alertPreferences", value)} />
                </div>
              </SettingsPanel>

              {notice && <p className={notice.type === "success" ? "formNotice success" : "formNotice"}>{notice.text}</p>}

              <div className="formActions">
                <button type="button" className="ghostButton" onClick={logout}>Sign out</button>
                <button type="submit" className="saveButton" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
              </div>
            </form>
          </section>
        </section>
      </main>
      <BusinessBottomNav />
      <style jsx>{styles}</style>
    </>
  );
}

function SettingsPanel({ id, title, note, children }: { id: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section id={id} className="settingsPanel">
      <div className="panelHeader">
        <h2>{title}</h2>
        <p>{note}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="formField">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function MultiSelect({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <details className="selectField">
      <summary>
        <span>
          <strong>{label}</strong>
          <small>{summarize(selected, "Select")}</small>
        </span>
        <em>{selected.length}</em>
      </summary>
      <div>
        {options.map((option) => (
          <label key={option} className={selected.includes(option) ? "checked" : ""}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

const styles = `
  :global(body) {
    background: #070808;
    color: #f7f7f7;
  }

  .profileShell {
    min-height: 100vh;
    padding: 24px 24px 112px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .025), transparent 280px),
      #070808;
  }

  .profileMain {
    max-width: 1160px;
    margin: 0 auto;
    display: grid;
    gap: 16px;
  }

  .settingsHeader,
  .settingsRail,
  .settingsPanel {
    border: 1px solid #232826;
    border-radius: 10px;
    background: #0d100f;
  }

  .settingsHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 20px;
  }

  .settingsHeader p,
  .panelHeader p,
  .formField span,
  .selectField small,
  .settingsRail span,
  .settingsRail dt {
    color: #9ca3a0;
  }

  .settingsHeader p {
    margin: 0 0 6px;
    color: #f5a623;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .settingsHeader h1 {
    margin: 0 0 6px;
    color: #fff;
    font-size: clamp(25px, 4vw, 36px);
    letter-spacing: 0;
  }

  .settingsHeader span {
    color: #c8ccc9;
  }

  .profileCompletion {
    width: min(100%, 220px);
    display: grid;
    gap: 7px;
  }

  .profileCompletion span {
    color: #9ca3a0;
    font-size: 12px;
    font-weight: 850;
  }

  .profileCompletion strong {
    color: #1aef22;
    font-size: 24px;
  }

  .profileCompletion i {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: #222725;
  }

  .profileCompletion b {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #1aef22;
  }

  .settingsLayout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .settingsRail {
    position: sticky;
    top: 20px;
    display: grid;
    gap: 16px;
    padding: 16px;
  }

  .railIdentity {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .accountMark {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 10px;
    background: #f5a623;
    color: #050505;
    font-size: 22px;
    font-weight: 950;
  }

  .railIdentity div:last-child {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .railIdentity strong {
    color: #fff;
    overflow-wrap: anywhere;
  }

  .railIdentity span {
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .settingsRail nav {
    display: grid;
    gap: 6px;
    border-top: 1px solid #202423;
    padding-top: 14px;
  }

  .settingsRail nav a {
    border: 1px solid transparent;
    border-radius: 8px;
    color: #d6dad7;
    padding: 10px 11px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 850;
  }

  .settingsRail nav a:hover {
    border-color: rgba(245, 166, 35, .28);
    background: rgba(245, 166, 35, .08);
    color: #fff;
  }

  .settingsRail dl {
    display: grid;
    gap: 10px;
    margin: 0;
    border-top: 1px solid #202423;
    padding-top: 14px;
  }

  .settingsRail dl div {
    display: grid;
    gap: 4px;
  }

  .settingsRail dt {
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .settingsRail dd {
    margin: 0;
    color: #f5f5f5;
    overflow-wrap: anywhere;
  }

  .settingsRail button {
    min-height: 42px;
    border: 0;
    border-radius: 8px;
    background: #f5a623;
    color: #050505;
    font-weight: 950;
    cursor: pointer;
  }

  .settingsEditor {
    display: grid;
    gap: 14px;
  }

  .settingsPanel {
    display: grid;
    gap: 16px;
    padding: 18px;
    scroll-margin-top: 18px;
  }

  .panelHeader {
    display: grid;
    gap: 5px;
  }

  .panelHeader h2 {
    margin: 0;
    color: #fff;
    font-size: 17px;
    letter-spacing: 0;
  }

  .panelHeader p {
    margin: 0;
    line-height: 1.55;
  }

  .fieldGrid,
  .dropdownGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .dropdownGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dropdownGrid.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .formField {
    display: grid;
    gap: 8px;
  }

  .formField.wide {
    grid-column: 1 / -1;
  }

  .formField span {
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .formField input,
  .formField textarea {
    width: 100%;
    border: 1px solid #252a28;
    border-radius: 8px;
    background: #080a09;
    color: #f7f7f7;
    padding: 12px;
    font: inherit;
    outline: 0;
  }

  .formField textarea {
    min-height: 118px;
    resize: vertical;
    line-height: 1.55;
  }

  .formField input:focus,
  .formField textarea:focus {
    border-color: rgba(245, 166, 35, .62);
    box-shadow: 0 0 0 3px rgba(245, 166, 35, .1);
  }

  .selectField {
    border: 1px solid #252a28;
    border-radius: 8px;
    background: #080a09;
  }

  .selectField[open] {
    border-color: rgba(245, 166, 35, .52);
  }

  .selectField summary {
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    cursor: pointer;
    list-style: none;
  }

  .selectField summary::-webkit-details-marker {
    display: none;
  }

  .selectField summary > span {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .selectField strong {
    color: #fff;
    font-size: 12px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .selectField small {
    overflow-wrap: anywhere;
  }

  .selectField em {
    min-width: 26px;
    height: 24px;
    display: inline-grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(245, 166, 35, .14);
    color: #f5a623;
    font-style: normal;
    font-size: 12px;
    font-weight: 950;
  }

  .selectField > div {
    display: grid;
    gap: 6px;
    max-height: 250px;
    overflow-y: auto;
    border-top: 1px solid #202423;
    padding: 10px;
  }

  .selectField label {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #202423;
    border-radius: 7px;
    background: #0d100f;
    color: #d8d8d8;
    padding: 9px 10px;
    font-size: 13px;
    font-weight: 850;
  }

  .selectField label.checked {
    border-color: rgba(245, 166, 35, .5);
    background: rgba(245, 166, 35, .1);
    color: #fff;
  }

  .selectField input {
    width: 15px;
    height: 15px;
    accent-color: #f5a623;
  }

  .formNotice {
    margin: 0;
    border: 1px solid rgba(229, 62, 62, .3);
    border-radius: 8px;
    background: rgba(229, 62, 62, .08);
    color: #ffb4b4;
    padding: 12px;
    font-weight: 850;
  }

  .formNotice.success {
    border-color: rgba(26, 239, 34, .28);
    background: rgba(26, 239, 34, .08);
    color: #1aef22;
  }

  .formActions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .formActions button {
    min-height: 44px;
    border-radius: 8px;
    padding: 0 15px;
    font-weight: 950;
    cursor: pointer;
  }

  .ghostButton {
    border: 1px solid rgba(229, 62, 62, .32);
    background: rgba(229, 62, 62, .08);
    color: #ff9d9d;
  }

  .saveButton,
  .saveButton {
    border: 0;
    background: #f5a623;
    color: #050505;
  }

  .saveButton:disabled {
    opacity: .62;
    cursor: not-allowed;
  }

  @media (min-width: 1024px) {
    .profileShell {
      display: flex;
      align-items: flex-start;
      padding: 0;
    }

    .profileMain {
      flex: 1;
      min-width: 0;
      max-width: none;
      margin: 0;
      padding: 24px 24px 48px;
    }
  }

  @media (max-width: 860px) {
    .profileShell {
      padding: 14px 14px 112px;
    }

    .settingsHeader,
    .settingsLayout {
      grid-template-columns: 1fr;
    }

    .settingsHeader {
      display: grid;
    }

    .settingsRail {
      position: static;
    }

    .fieldGrid,
    .dropdownGrid {
      grid-template-columns: 1fr;
    }
  }
`;
