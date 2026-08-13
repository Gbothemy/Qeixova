"use client";
import { useState } from "react";
import Image from "next/image";
import { INTEREST_OPTIONS } from "@/lib/interestTaxonomy";
import { WITHDRAWAL_UNLOCK_QLT } from "@/lib/rewardRules";

interface Props { userName: string; onComplete: () => void; }


const AGE_RANGES = ["18–24", "25–34", "35–44", "45+"];

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT (Abuja)","Gombe",
  "Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
  "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau",
  "Rivers","Sokoto","Taraba","Yobe","Zamfara",
];

const inp = {
  width: "100%", padding: "13px 14px", borderRadius: 12,
  border: "1.5px solid #222", fontSize: 14, outline: "none",
  color: "#F5F5F5", background: "#111",
};

function Chips({ options, selected, onChange, max }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; max?: number }) {
  const toggle = (v: string) => {
    if (selected.includes(v)) {
      onChange(selected.filter(s => s !== v));
      return;
    }
    if (max && selected.length >= max) return;
    onChange([...selected, v]);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {max && <p style={{ width: "100%", fontSize: 11, color: "#bbb", marginBottom: 2 }}>Select up to {max} - {selected.length}/{max} chosen</p>}
      {options.map(o => {
        const on = selected.includes(o);
        const atLimit = !on && max !== undefined && selected.length >= max;
        return (
          <button key={o} type="button" onClick={() => toggle(o)} disabled={atLimit} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 12, cursor: atLimit ? "not-allowed" : "pointer",
            fontWeight: on ? 700 : 400,
            border: `1.5px solid ${on ? "#1AEF22" : atLimit ? "#111" : "#222"}`,
            background: on ? "rgba(26,239,34,0.1)" : "transparent",
            color: on ? "#1AEF22" : atLimit ? "#444" : "#ccc",
            opacity: atLimit ? 0.4 : 1,
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i < current ? "#1AEF22" : "#1a1a1a", transition: "background 0.3s" }} />
      ))}
      <span style={{ fontSize: 11, color: "#aaa", flexShrink: 0 }}>{current}/{total}</span>
    </div>
  );
}

export default function OnboardingFlow({ userName, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — profile
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [state, setState] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");

  // Step 2 — interests
  const [interests, setInterests] = useState<string[]>([]);

  // Step 3 — bank
  const [bank, setBank] = useState({ bank_name: "", account_number: "", account_name: "" });

  // Step 4 — referral
  const [referralCode, setReferralCode] = useState("");

  const firstName = userName?.split(" ")[0] ?? "there";

  const handleFinish = async () => {
    setSaving(true);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bank, referralCode,
        interests: interests.slice(0, 5), platforms: [], age_range: ageRange, gender, country, state,
      }),
    });
    setSaving(false);
    onComplete();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>

      {/* ── STEP 0: Welcome ── */}
      {step === 0 && (
        <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
          <Image src="/qeixova-icon.png" alt="Qeixova" width={72} height={72} className="theme-icon" style={{ borderRadius: 20, objectFit: "contain", boxShadow: "0 8px 28px rgba(26,239,34,0.35)", marginBottom: 24 }} />
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#F5F5F5", letterSpacing: -0.5, marginBottom: 10 }}>
            Welcome, {firstName}!
          </h1>
          <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.7, marginBottom: 12 }}>
            You&apos;re joining Qeixova Tasks — a community-powered growth platform where you earn by helping businesses and creators reach real people.
          </p>
          <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, marginBottom: 32 }}>
            Complete participation tasks, earn QLT rewards, and convert to real Naira.
          </p>
          <button onClick={() => setStep(1)} style={{ width: "100%", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 13, padding: "15px", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 20px rgba(26,239,34,0.3)" }}>
            Set Up My Account →
          </button>
        </div>
      )}

      {/* ── STEP 1: Profile ── */}
      {step === 1 && (
        <div style={{ maxWidth: 420, width: "100%" }}>
          <StepBar current={1} total={4} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#F5F5F5", marginBottom: 4 }}>Your Profile</h2>
          <p style={{ fontSize: 13, color: "#bbb", marginBottom: 20 }}>Helps us recommend relevant campaigns for you.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>USERNAME</label>
              <input type="text" placeholder="e.g. john_contributor" value={username} onChange={e => setUsername(e.target.value)}
                style={{ ...inp, marginTop: 6 }} onFocus={e => (e.target.style.borderColor = "#1AEF22")} onBlur={e => (e.target.style.borderColor = "#222")} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>COUNTRY</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inp, marginTop: 6, cursor: "pointer" }}>
                  <option value="Nigeria">Nigeria</option>
                  <option value="Ghana">Ghana</option>
                  <option value="Kenya">Kenya</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>STATE</label>
                <select value={state} onChange={e => setState(e.target.value)} style={{ ...inp, marginTop: 6, cursor: "pointer" }}>
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>AGE RANGE</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {AGE_RANGES.map(a => (
                  <button key={a} type="button" onClick={() => setAgeRange(a)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: `1.5px solid ${ageRange === a ? "#1AEF22" : "#222"}`, background: ageRange === a ? "rgba(26,239,34,0.1)" : "transparent", color: ageRange === a ? "#1AEF22" : "#ccc", fontSize: 12, cursor: "pointer", fontWeight: ageRange === a ? 700 : 400 }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>GENDER</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {["Male", "Female", "Prefer not to say"].map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: `1.5px solid ${gender === g ? "#1AEF22" : "#222"}`, background: gender === g ? "rgba(26,239,34,0.1)" : "transparent", color: gender === g ? "#1AEF22" : "#ccc", fontSize: 11, cursor: "pointer", fontWeight: gender === g ? 700 : 400 }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={() => setStep(0)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #222", background: "transparent", color: "#bbb", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
            <button onClick={() => setStep(2)} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Interests & Platforms ── */}
      {step === 2 && (
        <div style={{ maxWidth: 440, width: "100%", position: "absolute", inset: 0, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: 440, paddingBottom: 40 }}>
            <StepBar current={2} total={4} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#F5F5F5", marginBottom: 4 }}>Your Interests</h2>
            <p style={{ fontSize: 13, color: "#bbb", marginBottom: 20 }}>We use this to recommend campaigns you&apos;ll actually enjoy completing.</p>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>INTERESTS</label>
              <Chips options={[...INTEREST_OPTIONS]} selected={interests} onChange={setInterests} max={5} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #222", background: "transparent", color: "#bbb", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Continue →</button>
            </div>
            <button onClick={() => setStep(3)} style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}>Skip for now</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Bank Account ── */}
      {step === 3 && (
        <div style={{ maxWidth: 420, width: "100%" }}>
          <StepBar current={3} total={4} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#F5F5F5", marginBottom: 4 }}>Set Up Withdrawals</h2>
          <p style={{ fontSize: 13, color: "#bbb", marginBottom: 6 }}>Add your bank account so you can withdraw your earnings.</p>
          <div style={{ background: "rgba(26,239,34,0.06)", border: "1px solid rgba(26,239,34,0.12)", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "#1AEF22", fontWeight: 600 }}>🔒 Withdrawals unlock at {WITHDRAWAL_UNLOCK_QLT.toLocaleString()} QLT lifetime earnings (Bronze level)</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { key: "bank_name",      label: "BANK NAME",       placeholder: "e.g. GTBank, Opay, Palmpay" },
              { key: "account_number", label: "ACCOUNT NUMBER",  placeholder: "10-digit account number" },
              { key: "account_name",   label: "ACCOUNT NAME",    placeholder: "Name on account" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 0.5 }}>{f.label}</label>
                <input type="text" placeholder={f.placeholder} value={bank[f.key as keyof typeof bank]}
                  onChange={e => setBank(b => ({ ...b, [f.key]: e.target.value }))}
                  style={{ ...inp, marginTop: 6 }} onFocus={e => (e.target.style.borderColor = "#1AEF22")} onBlur={e => (e.target.style.borderColor = "#222")} />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #222", background: "transparent", color: "#bbb", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
            <button onClick={() => setStep(4)} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Continue →</button>
          </div>
          <button onClick={() => setStep(4)} style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}>Skip — add later in Profile</button>
        </div>
      )}

      {/* ── STEP 4: Referral ── */}
      {step === 4 && (
        <div style={{ maxWidth: 420, width: "100%" }}>
          <StepBar current={4} total={4} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#F5F5F5", marginBottom: 4 }}>Have a referral code?</h2>
          <p style={{ fontSize: 13, color: "#bbb", marginBottom: 24 }}>Optional — enter a code to get a welcome bonus.</p>

          <input type="text" placeholder="ENTER REFERRAL CODE (OPTIONAL)" value={referralCode}
            onChange={e => setReferralCode(e.target.value.toUpperCase())}
            style={{ ...inp, textTransform: "uppercase", letterSpacing: 1 }}
            onFocus={e => (e.target.style.borderColor = "#1AEF22")} onBlur={e => (e.target.style.borderColor = "#222")} />

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={() => setStep(3)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #222", background: "transparent", color: "#bbb", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
            <button onClick={handleFinish} disabled={saving} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #F5A623, #d89420)", color: "#000", fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 6px 20px rgba(245,166,35,0.3)" }}>
              {saving ? "Saving..." : "Start Completing Tasks →"}
            </button>
          </div>
          <button onClick={handleFinish} disabled={saving} style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}>
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
