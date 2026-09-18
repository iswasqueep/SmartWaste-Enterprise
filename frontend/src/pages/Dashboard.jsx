import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Leaf,
  RefreshCw,
  Recycle,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";

import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/dashboard.css";

function formatNumber(value) {
  return new Intl.NumberFormat("en-NG").format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRole(value) {
  return String(value || "customer")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getErrorMessage(error) {
  if (!error.response) {
    return "Unable to connect to the backend. Confirm that Flask is running.";
  }

  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    `Unable to load dashboard data. HTTP ${error.response.status}.`
  );
}

function MiniBarChart({ rows }) {
  const maxValue = Math.max(
    1,
    ...rows.map((row) => Number(row.collections || 0)),
  );

  return (
    <div className="mini-chart" aria-label="Seven day collection trend">
      {rows.map((row) => {
        const height = Math.max(
          8,
          Math.round((Number(row.collections || 0) / maxValue) * 150),
        );

        return (
          <div className="mini-chart-column" key={row.date || row.day}>
            <div className="mini-chart-value">{row.collections || 0}</div>
            <div
              className="mini-chart-bar"
              style={{ height: `${height}px` }}
              title={`${row.day}: ${row.collections || 0} collection(s)`}
            />
            <span>{row.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function WasteDistribution({ rows }) {
  const total = rows.reduce(
    (sum, row) => sum + Number(row.weight_kg || 0),
    0,
  );

  if (!rows.length) {
    return <div className="dashboard-empty">No waste data is available yet.</div>;
  }

  return (
    <div className="waste-list">
      {rows.slice(0, 6).map((row) => {
        const percentage = total
          ? Math.round((Number(row.weight_kg || 0) / total) * 100)
          : 0;

        return (
          <div className="waste-item" key={row.category}>
            <div className="waste-item-heading">
              <strong>{row.category}</strong>
              <span>{formatNumber(row.weight_kg)} kg · {percentage}%</span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState({
    summary: {},
    collection_trend: [],
    waste_distribution: [],
    recent_pickups: [],
    recent_users: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/dashboard");

      setDashboard({
        summary: response.data?.summary || {},
        collection_trend: response.data?.collection_trend || [],
        waste_distribution: response.data?.waste_distribution || [],
        recent_pickups: response.data?.recent_pickups || [],
        recent_users: response.data?.recent_users || [],
      });
    } catch (requestError) {
      console.error("Dashboard request failed:", requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const summary = dashboard.summary;

  const operationsCards = useMemo(
    () => [
      {
        label: "Total Pickups",
        value: formatNumber(summary.total_pickups),
        helper: `${formatNumber(summary.today_pickups)} scheduled today`,
        icon: Truck,
      },
      {
        label: "Pending Operations",
        value: formatNumber(summary.pending_pickups),
        helper: `${formatNumber(summary.unassigned_pickups)} unassigned`,
        icon: Clock3,
      },
      {
        label: "Completed Pickups",
        value: formatNumber(summary.completed_pickups),
        helper: `${Number(summary.completion_rate || 0).toFixed(1)}% completion rate`,
        icon: CheckCircle2,
      },
      {
        label: "Collected Weight",
        value: `${formatNumber(summary.total_weight_kg)} kg`,
        helper: `${Number(summary.recycling_rate || 0).toFixed(1)}% recyclable`,
        icon: Recycle,
      },
    ],
    [summary],
  );

  const peopleCards = useMemo(
    () => [
      {
        label: "Registered Users",
        value: formatNumber(summary.total_users),
        helper: `${formatNumber(summary.active_users)} active`,
        icon: Users,
      },
      {
        label: "Pending Approvals",
        value: formatNumber(summary.pending_approvals),
        helper: "Requires administrator review",
        icon: UserCheck,
      },
      {
        label: "Available Collectors",
        value: formatNumber(summary.available_collectors),
        helper: `${formatNumber(summary.active_collectors)} active collectors`,
        icon: Leaf,
      },
      {
        label: "Available Vehicles",
        value: formatNumber(summary.available_vehicles),
        helper: `${formatNumber(summary.total_vehicles)} total vehicles`,
        icon: Truck,
      },
    ],
    [summary],
  );

  return (
    <section className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">SmartWaste Operations Centre</span>
          <h1>Administrator Dashboard</h1>
          <p>
            Monitor collections, users, vehicles, recycling performance and revenue.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="dashboard-alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      <section className="revenue-strip">
        <article>
          <div className="revenue-icon"><Banknote size={24} /></div>
          <div>
            <span>Total Revenue</span>
            <strong>{formatCurrency(summary.total_revenue)}</strong>
          </div>
        </article>

        <article>
          <div className="revenue-icon"><Banknote size={24} /></div>
          <div>
            <span>Revenue This Month</span>
            <strong>{formatCurrency(summary.monthly_revenue)}</strong>
          </div>
        </article>

        <article>
          <div className="revenue-icon"><Recycle size={24} /></div>
          <div>
            <span>Recycling Rate</span>
            <strong>{Number(summary.recycling_rate || 0).toFixed(1)}%</strong>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-title">
          <div>
            <h2>Operations Overview</h2>
            <p>Live collection and service-delivery indicators.</p>
          </div>
        </div>

        <div className="dashboard-cards">
          {operationsCards.map(({ label, value, helper, icon: Icon }) => (
            <article className="dashboard-card" key={label}>
              <div className="dashboard-card-icon">
                <Icon size={22} />
              </div>

              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{helper}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title">
          <div>
            <h2>Resources and Access</h2>
            <p>Workforce, fleet and account availability.</p>
          </div>
        </div>

        <div className="dashboard-cards">
          {peopleCards.map(({ label, value, helper, icon: Icon }) => (
            <article className="dashboard-card" key={label}>
              <div className="dashboard-card-icon">
                <Icon size={22} />
              </div>

              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{helper}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analytics-grid">
        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h2>Seven-Day Collection Trend</h2>
              <p>Pickup requests created during the last seven days.</p>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-empty">Loading collection trend...</div>
          ) : (
            <MiniBarChart rows={dashboard.collection_trend} />
          )}
        </article>

        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h2>Waste Distribution</h2>
              <p>Recorded weight by waste category.</p>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-empty">Loading waste distribution...</div>
          ) : (
            <WasteDistribution rows={dashboard.waste_distribution} />
          )}
        </article>
      </section>

      <section className="activity-grid">
        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h2>Recent Pickup Requests</h2>
              <p>Latest customer collection activity.</p>
            </div>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.recent_pickups.length ? (
                  dashboard.recent_pickups.map((pickup) => (
                    <tr key={pickup.id || pickup.reference}>
                      <td><strong>{pickup.reference || "—"}</strong></td>
                      <td>
                        {pickup.customer?.full_name ||
                          pickup.customer_name ||
                          "—"}
                      </td>
                      <td>{formatDate(pickup.pickup_date || pickup.created_at)}</td>
                      <td><StatusBadge status={pickup.status || "pending"} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="dashboard-empty">
                      No pickup activity is available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h2>Recent Registrations</h2>
              <p>Newest platform user accounts.</p>
            </div>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Approval</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.recent_users.length ? (
                  dashboard.recent_users.map((user) => (
                    <tr key={user.id || user.email}>
                      <td>
                        <strong>{user.full_name || "Unnamed User"}</strong>
                        <span className="table-subtext">{user.email || ""}</span>
                      </td>
                      <td>{formatRole(user.role)}</td>
                      <td>
                        <StatusBadge
                          status={user.approval_status || "pending"}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="dashboard-empty">
                      No recent registrations are available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}
