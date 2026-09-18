import { useEffect, useMemo, useState } from "react";
import { Check, Eye, RefreshCw, Search, ShieldCheck, UserCheck, UserRound, UserX, X } from "lucide-react";
import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/users.css";

const normalizeUser = (user = {}) => ({
  ...user,
  id: user.id ?? user.user_id,
  full_name: user.full_name ?? user.name ?? [user.first_name, user.last_name].filter(Boolean).join(" "),
  email: user.email ?? "",
  phone: user.phone ?? user.phone_number ?? "",
  role: String(user.role ?? "customer").toLowerCase(),
  approval_status: String(user.approval_status ?? user.approval ?? "pending").toLowerCase(),
  is_active: user.is_active ?? user.active ?? true,
  created_at: user.created_at ?? user.date_created ?? null,
});

const formatRole = (role) => String(role || "customer").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
const apiError = (error, fallback) => error.response?.data?.message || error.response?.data?.error || (error.response ? `${fallback} (${error.response.status})` : "Unable to connect to the backend server.");

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    try {
      setLoading(true); setError("");
      const response = await api.get("/admin/users");
      const data = response.data?.items ?? response.data?.users ?? response.data ?? [];
      setUsers(Array.isArray(data) ? data.map(normalizeUser) : []);
    } catch (e) { setError(apiError(e, "Unable to load users")); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); }, []);

  async function updateApproval(user, approval_status) {
    if (!window.confirm(`${approval_status === "approved" ? "Approve" : "Reject"} ${user.full_name || user.email}?`)) return;
    try {
      setWorkingId(user.id); setError(""); setMessage("");
      await api.patch(`/admin/users/${user.id}/approval`, { approval_status });
      setUsers(list => list.map(item => item.id === user.id ? { ...item, approval_status } : item));
      setSelected(item => item?.id === user.id ? { ...item, approval_status } : item);
      setMessage(`User ${approval_status} successfully.`);
    } catch (e) { setError(apiError(e, "Unable to update approval")); }
    finally { setWorkingId(null); }
  }

  async function updateStatus(user, is_active) {
    if (!window.confirm(`${is_active ? "Activate" : "Deactivate"} ${user.full_name || user.email}?`)) return;
    try {
      setWorkingId(user.id); setError(""); setMessage("");
      await api.patch(`/admin/users/${user.id}/status`, { is_active });
      setUsers(list => list.map(item => item.id === user.id ? { ...item, is_active } : item));
      setSelected(item => item?.id === user.id ? { ...item, is_active } : item);
      setMessage(`User account ${is_active ? "activated" : "deactivated"}.`);
    } catch (e) { setError(apiError(e, "Unable to update account status")); }
    finally { setWorkingId(null); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(user => {
      const matchesSearch = !q || [user.full_name, user.email, user.phone, user.role].some(v => String(v || "").toLowerCase().includes(q));
      return matchesSearch && (!roleFilter || user.role === roleFilter) && (!approvalFilter || user.approval_status === approvalFilter);
    });
  }, [users, search, roleFilter, approvalFilter]);

  const summary = useMemo(() => users.reduce((acc, user) => {
    acc.total += 1;
    acc[user.approval_status] = (acc[user.approval_status] || 0) + 1;
    if (!user.is_active) acc.inactive += 1;
    return acc;
  }, { total: 0, pending: 0, approved: 0, rejected: 0, inactive: 0 }), [users]);

  return (
    <section className="users-page" style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
      <header className="users-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "#166534", background: "#f0fdf4", padding: "4px 10px", borderRadius: "20px", marginBottom: "8px" }}>
            <ShieldCheck size={15}/> Administration
          </span>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>User Management</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Review registrations, approve user accounts and control platform access.</p>
        </div>
        <button type="button" className="secondary" onClick={loadUsers} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "10px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />{loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {message && <div className="user-alert success" style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: "10px", marginBottom: "20px", fontSize: "0.9rem" }}>{message}</div>}
      {error && <div className="user-alert error" style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", borderRadius: "10px", marginBottom: "20px", fontSize: "0.9rem" }}>{error}</div>}

      <div className="user-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {[
          ["total", "Total Users", UserRound],
          ["pending", "Pending Approval", ShieldCheck],
          ["approved", "Approved", UserCheck],
          ["rejected", "Rejected", UserX],
          ["inactive", "Inactive", UserX]
        ].map(([key, label, Icon]) => (
          <article key={key} style={{ background: "#ffffff", padding: "20px", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "12px", color: "#00a651" }}>
              <Icon size={22} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>{label}</span>
              <strong style={{ fontSize: "1.5rem", color: "#0f172a", fontWeight: 700 }}>{summary[key] || 0}</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="users-panel" style={{ background: "#ffffff", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {/* Fixed Search Bar Container Style to eliminate double border artifact */}
        <div className="user-toolbar" style={{ padding: "20px", display: "flex", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
          <label className="user-search" style={{ flex: 1, minWidth: "260px", position: "relative", display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "0 14px" }}>
            <Search size={18} style={{ color: "#94a3b8", marginRight: "10px", flexShrink: 0 }} />
            <input 
              type="search" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search name, email, phone or role" 
              style={{ width: "100%", padding: "10px 0", border: "none", outline: "none", fontSize: "0.9rem", background: "transparent", color: "#334155" }}
            />
          </label>
          <select 
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.9rem", background: "#f8fafc", color: "#334155", outline: "none", cursor: "pointer" }}
          >
            <option value="">All roles</option>
            <option value="customer">Customer</option>
            <option value="collector">Collector</option>
            <option value="recycling_company">Recycling Company</option>
            <option value="government">Government</option>
            <option value="admin">Administrator</option>
          </select>
          <select 
            value={approvalFilter} 
            onChange={e => setApprovalFilter(e.target.value)}
            style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.9rem", background: "#f8fafc", color: "#334155", outline: "none", cursor: "pointer" }}
          >
            <option value="">All approvals</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 600 }}>User</th>
                <th style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 600 }}>Role</th>
                <th style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 600 }}>Approval</th>
                <th style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 600 }}>Account</th>
                <th style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 600 }}>Registered</th>
                <th style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="empty" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Loading users...</td></tr>
              ) : filtered.length ? (
                filtered.map(user => (
                  <tr key={user.id || user.email} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div className="user-identity" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="user-avatar" style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#00a651", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.95rem", flexShrink: 0 }}>
                          {(user.full_name || user.email || "U").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ display: "block", color: "#0f172a", fontSize: "0.92rem" }}>{user.full_name || "Unnamed User"}</strong>
                          <span style={{ color: "#64748b", fontSize: "0.82rem" }}>{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "#334155", fontSize: "0.9rem" }}>{formatRole(user.role)}</td>
                    <td style={{ padding: "14px 20px" }}><StatusBadge status={user.approval_status} /></td>
                    <td style={{ padding: "14px 20px" }}><StatusBadge status={user.is_active ? "active" : "inactive"} /></td>
                    <td style={{ padding: "14px 20px", color: "#64748b", fontSize: "0.88rem" }}>{formatDate(user.created_at)}</td>
                    <td style={{ padding: "14px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {/* Enforced row direction layout for actions */}
                      <div className="user-actions" style={{ display: "flex", flexDirection: "row", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                        <button type="button" className="icon" onClick={() => setSelected(user)} title="View Details" style={{ padding: "6px", background: "#f1f5f9", border: "none", borderRadius: "8px", cursor: "pointer", color: "#475569", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <Eye size={16} />
                        </button>
                        {user.approval_status !== "approved" && (
                          <button type="button" className="action approve" onClick={() => updateApproval(user, "approved")} disabled={workingId === user.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: "#dcfce7", color: "#166534", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                            <Check size={14} />Approve
                          </button>
                        )}
                        {user.approval_status !== "rejected" && (
                          <button type="button" className="action reject" onClick={() => updateApproval(user, "rejected")} disabled={workingId === user.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                            <X size={14} />Reject
                          </button>
                        )}
                        {user.role !== "admin" && (
                          <button type="button" className={`action ${user.is_active ? "deactivate" : "activate"}`} onClick={() => updateStatus(user, !user.is_active)} disabled={workingId === user.id} style={{ padding: "6px 12px", background: user.is_active ? "#fef2f2" : "#f0fdf4", color: user.is_active ? "#991b1b" : "#166534", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="empty" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>No users match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <section className="user-modal" style={{ background: "#ffffff", borderRadius: "20px", width: "100%", maxWidth: "540px", padding: "28px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div className="modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600, letterSpacing: "0.05em" }}>User Profile</span>
                <h2 style={{ fontSize: "1.25rem", color: "#0f172a", margin: "2px 0 0 0" }}>{selected.full_name || selected.email}</h2>
              </div>
              <button type="button" className="icon" onClick={() => setSelected(null)} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}>
                <X size={18} />
              </button>
            </div>
            
            <div className="user-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8fafc", padding: "16px", borderRadius: "12px", marginBottom: "24px" }}>
              <div><span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Email</span><strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>{selected.email || "—"}</strong></div>
              <div><span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Phone</span><strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>{selected.phone || "—"}</strong></div>
              <div><span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Role</span><strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>{formatRole(selected.role)}</strong></div>
              <div><span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Approval</span><StatusBadge status={selected.approval_status} /></div>
              <div><span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Account</span><StatusBadge status={selected.is_active ? "active" : "inactive"} /></div>
              <div><span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Registered</span><strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>{formatDate(selected.created_at)}</strong></div>
            </div>

            <div className="user-modal-actions" style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              {selected.approval_status !== "approved" && (
                <button className="action approve" onClick={() => updateApproval(selected, "approved")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 16px", background: "#dcfce7", color: "#166534", border: "none", borderRadius: "10px", fontWeight: 600, cursor: "pointer" }}>
                  <Check size={16} />Approve User
                </button>
              )}
              {selected.approval_status !== "rejected" && (
                <button className="action reject" onClick={() => updateApproval(selected, "rejected")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 16px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "10px", fontWeight: 600, cursor: "pointer" }}>
                  <X size={16} />Reject User
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}