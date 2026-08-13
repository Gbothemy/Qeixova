"use client";
import { useEffect, useState, useCallback } from "react";

interface User {
  id: number;
  full_name: string;
  email: string;
  balance: number;
  tasks_completed: number;
  created_at: string;
  banned: boolean;
}

const TH: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#ccc",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 14,
  color: "#999",
  borderBottom: "1px solid #f5f5f5",
  verticalAlign: "middle",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page) });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { void Promise.resolve().then(fetchUsers); }, [fetchUsers]);

  async function toggleBan(user: User) {
    setActionLoading(user.id);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, action: user.banned ? "unban" : "ban" }),
      });
      fetchUsers();
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Users</h1>
      <p style={{ margin: "0 0 24px", color: "#ccc", fontSize: 14 }}>
        {total.toLocaleString()} total users
      </p>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            padding: "10px 16px",
            border: "1.5px solid #e0e0e0",
            borderRadius: 8,
            fontSize: 14,
            width: 320,
            outline: "none",
          }}
        />
      </div>

      <div className="admin-table-wrap" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={TH}>ID</th>
              <th style={TH}>Name</th>
              <th style={TH}>Email</th>
              <th style={TH}>Balance (QLT)</th>
              <th style={TH}>Tasks Done</th>
              <th style={TH}>Joined</th>
              <th style={TH}>Status</th>
              <th style={TH}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ ...TD, textAlign: "center", color: "#aaa", padding: 40 }}>
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...TD, textAlign: "center", color: "#aaa", padding: 40 }}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} style={{ background: u.banned ? "#fff8f8" : "transparent" }}>
                  <td style={TD}>{u.id}</td>
                  <td style={{ ...TD, fontWeight: 500 }}>{u.full_name}</td>
                  <td style={{ ...TD, color: "#ccc" }}>{u.email}</td>
                  <td style={TD}>{Number(u.balance).toLocaleString()}</td>
                  <td style={{ ...TD, textAlign: "center" }}>{u.tasks_completed}</td>
                  <td style={{ ...TD, color: "#ccc" }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={TD}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: u.banned ? "#ffebeb" : "#e8f5e9",
                        color: u.banned ? "#cc0000" : "#2e7d32",
                      }}
                    >
                      {u.banned ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td style={TD}>
                    <button
                      onClick={() => toggleBan(u)}
                      disabled={actionLoading === u.id}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        background: u.banned ? "#1AEF22" : "#cc0000",
                        color: "#fff",
                        opacity: actionLoading === u.id ? 0.6 : 1,
                      }}
                    >
                      {u.banned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "center" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "#ccc" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

