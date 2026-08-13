"use client";
import { useEffect, useState, useCallback } from "react";

interface Task {
  id: number; title: string; category: string; reward: number;
  duration: string; proof_type: string; max_screenshots: number;
  is_active: boolean; total_budget: number; budget_used: number;
  mission_type: string; xp_reward: number; min_level: number;
  task_link?: string;
  business_name?: string;
  task_status?: string;
  campaign_status?: string;
  campaign_metadata?: {
    selectedPricingLabel?: string;
    selectedPricingPlatforms?: string[];
    selectedInterests?: string[];
    targetLocation?: { summary?: string };
  };
  target_completion_count?: number;
  target_interests?: string[];
  target_platforms?: string[];
  target_states?: string[];
  pending_count?: number;
  approved_count?: number;
}

const EMPTY_FORM = {
  title: "", category: "", reward: "", duration: "5 min",
  icon: "📋", color: "#e8f5e9", instructions: "", steps: "",
  proof_type: "screenshot", proof_label: "Upload screenshot as proof",
  max_screenshots: "1", total_budget: "0", task_link: "",
  mission_type: "engagement", xp_reward: "0", min_level: "1",
  target_interests: "", target_states: "", target_platforms: "",
};

const MISSION_COLORS: Record<string, { bg: string; color: string }> = {
  engagement:    { bg: "#e3f2fd", color: "#1565c0" },
  participation: { bg: "#fff8e1", color: "#e67e22" },
  premium:       { bg: "#f3e5f5", color: "#7b1fa2" },
};

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "12px 14px", fontSize: 13, color: "#374151", borderBottom: "1px solid #eef0f3", verticalAlign: "middle" };

function list(values: string[] | undefined, fallback = "Broad") {
  return values?.length ? values.join(", ") : fallback;
}

function linesToList(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function getLocation(task: Task) {
  return task.campaign_metadata?.targetLocation?.summary || list(task.target_states, "Nationwide");
}

function getInterests(task: Task) {
  return list(task.campaign_metadata?.selectedInterests?.length ? task.campaign_metadata.selectedInterests : task.target_interests, "Broad audience");
}

function getPlatforms(task: Task) {
  return task.campaign_metadata?.selectedPricingLabel || list(task.campaign_metadata?.selectedPricingPlatforms?.length ? task.campaign_metadata.selectedPricingPlatforms : task.target_platforms, "All platforms");
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load missions");
      setTasks(data.tasks ?? []);
    } catch (error) {
      setTasks([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load missions" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchTasks); }, [fetchTasks]);

  function openAdd() { setEditTask(null); setForm(EMPTY_FORM); setShowModal(true); }

  function openEdit(t: Task) {
    setEditTask(t);
    setForm({
      title: t.title, category: t.category, reward: String(t.reward),
      duration: t.duration, icon: "📋", color: "#e8f5e9", instructions: "", steps: "",
      proof_type: t.proof_type, proof_label: "Upload screenshot as proof",
      max_screenshots: String(t.max_screenshots), total_budget: String(t.total_budget ?? 0),
      task_link: t.task_link ?? "",
      mission_type: t.mission_type ?? "engagement",
      xp_reward: String(t.xp_reward ?? 0),
      min_level: String(t.min_level ?? 1),
      target_interests: (t.target_interests ?? []).join("\n"),
      target_states: (t.target_states ?? []).join("\n"),
      target_platforms: (t.target_platforms ?? []).join("\n"),
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        ...form,
        reward: Number(form.reward), max_screenshots: Number(form.max_screenshots),
        total_budget: Number(form.total_budget), task_link: form.task_link.trim(),
        xp_reward: Number(form.xp_reward), min_level: Number(form.min_level),
        steps: form.steps ? form.steps.split("\n").filter(Boolean) : [],
        target_interests: linesToList(form.target_interests),
        target_states: linesToList(form.target_states),
        target_platforms: linesToList(form.target_platforms),
      };
      if (editTask) {
        const res = await fetch("/api/admin/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editTask.id, ...payload }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Mission update failed");
        setNotice({ type: "success", message: "Mission updated successfully." });
      } else {
        const res = await fetch("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Mission creation failed");
        setNotice({ type: "success", message: "Mission created successfully." });
      }
      setShowModal(false);
      fetchTasks();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Mission save failed" });
    } finally { setSaving(false); }
  }

  async function toggleActive(t: Task) {
    setActionLoading(t.id);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, is_active: !t.is_active }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Mission status update failed");
      setNotice({ type: "success", message: `Mission ${t.is_active ? "paused" : "activated"} successfully.` });
      fetchTasks();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Mission status update failed" });
    } finally { setActionLoading(null); }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1.5px solid #e0e0e0", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 800, color: "#4b5563", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <div className="adminPage">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>Missions</h1>
          <p style={{ margin: 0, color: "#5f6876", fontSize: 13 }}>{tasks.length} missions total</p>
        </div>
        <button onClick={openAdd} style={{ padding: "9px 18px", background: "#1AEF22", color: "#000", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add Mission
        </button>
      </div>

      {notice && (
        <div className={`adminResult${notice.type === "error" ? " error" : ""}`}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={TH}>ID</th>
              <th style={TH}>Title</th>
              <th style={TH}>Type</th>
              <th style={TH}>Category</th>
              <th style={TH}>Campaign Fit</th>
              <th style={TH}>Reward</th>
              <th style={TH}>Progress</th>
              <th style={TH}>Status</th>
              <th style={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>Loading...</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={9} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>No missions found</td></tr>
            ) : tasks.map(t => {
              const mt = MISSION_COLORS[t.mission_type ?? "engagement"] ?? MISSION_COLORS.engagement;
              return (
                <tr key={t.id}>
                  <td style={{ ...TD, color: "#667085" }}>{t.id}</td>
                  <td style={{ ...TD, fontWeight: 500, maxWidth: 220 }}>
                    <div>{t.title}</div>
                    {t.business_name ? <div style={{ fontSize: 11, color: "#5f6876", marginTop: 3 }}>{t.business_name}</div> : null}
                  </td>
                  <td style={TD}><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: mt.bg, color: mt.color }}>{t.mission_type ?? "engagement"}</span></td>
                  <td style={TD}>{t.category}</td>
                  <td style={{ ...TD, minWidth: 250 }}>
                    <div style={{ display: "grid", gap: 4, fontSize: 11, lineHeight: 1.35 }}>
                      <span><strong style={{ color: "#555" }}>Location:</strong> {getLocation(t)}</span>
                      <span><strong style={{ color: "#555" }}>Interests:</strong> {getInterests(t)}</span>
                      <span><strong style={{ color: "#555" }}>Platforms:</strong> {getPlatforms(t)}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, fontWeight: 600 }}>{Number(t.reward).toLocaleString()}</td>
                  <td style={TD}>
                    {t.total_budget > 0 ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{Number(t.total_budget).toLocaleString()}</div>
                        <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 3, width: 60 }}>
                          <div style={{ height: "100%", borderRadius: 2, background: t.budget_used >= t.total_budget ? "#cc0000" : "#1AEF22", width: `${Math.min(100, (t.budget_used / t.total_budget) * 100)}%` }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#5f6876", marginTop: 3 }}>
                          {t.approved_count ?? 0} approved / {(t.target_completion_count ?? 0) || "open"} target
                        </div>
                      </div>
                    ) : <span style={{ color: "#667085", fontSize: 12 }}>∞</span>}
                  </td>
                  <td style={TD}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ display: "inline-block", width: "fit-content", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: t.is_active ? "#e8f5e9" : "#f3f4f6", color: t.is_active ? "#2e7d32" : "#4b5563" }}>
                        {t.campaign_status ?? t.task_status ?? (t.is_active ? "active" : "inactive")}
                      </span>
                      <span style={{ fontSize: 11, color: "#5f6876" }}>{t.pending_count ?? 0} pending proof</span>
                    </div>
                  </td>
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(t)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #1AEF22", background: "transparent", color: "#1AEF22", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Edit</button>
                      <button onClick={() => toggleActive(t)} disabled={actionLoading === t.id}
                        style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: t.is_active ? "#e67e22" : "#1AEF22", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, opacity: actionLoading === t.id ? 0.6 : 1 }}>
                        {t.is_active ? "Pause" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>{editTask ? "Edit Mission" : "Add New Mission"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Mission type */}
              <div>
                <label style={lbl}>Mission Type *</label>
                <select style={inp} value={form.mission_type} onChange={e => {
                  const mt = e.target.value;
                  const xp = "0";
                  const ml = mt === "premium" ? "2" : "1";
                  setForm(f => ({ ...f, mission_type: mt, xp_reward: xp, min_level: ml }));
                }}>
                  <option value="engagement">Engagement (low value)</option>
                  <option value="participation">Participation (medium)</option>
                  <option value="premium">Premium (high value)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Category *</label>
                <input style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Social Media, Survey…" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Title *</label>
                <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Reward (QLT) *</label>
                <input style={inp} type="number" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>QLT Bonus</label>
                <input style={inp} type="number" value={form.xp_reward} onChange={e => setForm(f => ({ ...f, xp_reward: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Min Level (1–5)</label>
                <input style={inp} type="number" min={1} max={5} value={form.min_level} onChange={e => setForm(f => ({ ...f, min_level: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Duration</label>
                <input style={inp} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" />
              </div>
              <div>
                <label style={lbl}>Proof Type</label>
                <select style={inp} value={form.proof_type} onChange={e => setForm(f => ({ ...f, proof_type: e.target.value }))}>
                  <option value="screenshot">Screenshot</option>
                  <option value="url">URL</option>
                  <option value="text">Text</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Total Budget (QLT)</label>
                <input style={inp} type="number" min={0} value={form.total_budget} onChange={e => setForm(f => ({ ...f, total_budget: e.target.value }))} placeholder="0 = unlimited" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Task Link (URL)</label>
                <input style={inp} type="url" value={form.task_link} onChange={e => setForm(f => ({ ...f, task_link: e.target.value }))} placeholder="https://…" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Proof Label</label>
                <input style={inp} value={form.proof_label} onChange={e => setForm(f => ({ ...f, proof_label: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Target Interests</label>
                <textarea style={{ ...inp, minHeight: 58, resize: "vertical" }} value={form.target_interests} onChange={e => setForm(f => ({ ...f, target_interests: e.target.value }))} placeholder={"Music & Entertainment\nFashion & Beauty\nBusiness & Entrepreneurship"} />
              </div>
              <div>
                <label style={lbl}>Target States / Locations</label>
                <textarea style={{ ...inp, minHeight: 58, resize: "vertical" }} value={form.target_states} onChange={e => setForm(f => ({ ...f, target_states: e.target.value }))} placeholder={"Lagos\nOyo"} />
              </div>
              <div>
                <label style={lbl}>Platform Labels</label>
                <textarea style={{ ...inp, minHeight: 58, resize: "vertical" }} value={form.target_platforms} onChange={e => setForm(f => ({ ...f, target_platforms: e.target.value }))} placeholder={"WhatsApp Status\nInstagram Story"} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Instructions</label>
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Steps (one per line)</label>
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} placeholder={"Step 1\nStep 2\nStep 3"} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.category || !form.reward}
                style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#1AEF22", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editTask ? "Save Changes" : "Create Mission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
