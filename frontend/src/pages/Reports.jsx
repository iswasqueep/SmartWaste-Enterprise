import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Download,
  FileText,
  Leaf,
  RefreshCw,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api";
import "../styles/reports.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits,
  }).format(Number(value || 0));
}

function getErrorMessage(error) {
  if (!error.response) {
    return "Unable to connect to the backend server.";
  }

  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    `Unable to load reports. HTTP ${error.response.status}.`
  );
}

function downloadCsv(filename, rows) {
  if (!rows || !rows.length) return;

  const headers = Object.keys(rows[0]);

  const escapeValue = (value) => {
    const text = String(value ?? "");

    if (
      text.includes(",") ||
      text.includes('"') ||
      text.includes("\n")
    ) {
      return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => escapeValue(row[header]))
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function Reports() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const role = String(user.role || "").trim().toLowerCase();

const isAdmin = role === "admin";
const isGovernment = role === "government";

  const [report, setReport] = useState(null);
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

 async function loadReport() {
  try {
    setLoading(true);
    setError("");

    let response;

    if (isAdmin) {
      // Administrator gets the full system report
      response = await api.get("/admin/reports", {
        params: {
          days: range,
        },
      });

      setReport(response.data);
      return;
    }

    if (isGovernment) {
      // Government gets read-only government oversight data
      response = await api.get("/government/dashboard");

      const metrics = response.data?.metrics || {};

      /*
       * Convert the government response into the same
       * structure used by the Reports page.
       *
       * This allows us to reuse the existing report UI
       * without changing the administrator report endpoint.
       */
      setReport({
        summary: {
          total_users: 0,
          active_users: 0,

          total_pickups:
            Number(metrics.total_collections) || 0,

          completed_pickups:
            Number(metrics.completed_collections) || 0,

          total_weight_kg:
            Number(metrics.total_actual_weight) ||
            Number(metrics.total_estimated_weight) ||
            0,

          recycling_rate:
            Number(metrics.recycling_rate) || 0,

          total_revenue: 0,

          completion_rate:
            Number(metrics.completion_rate) || 0,
        },

        collection_trend: [],

        // Government should not see financial information
        revenue_trend: [],

        waste_distribution: [
          {
            category: "Recyclable material",
            weight_kg:
              Number(metrics.recyclable_weight) || 0,
          },
        ],

        user_distribution: [],

        pickup_status_distribution: [
          {
            status: "Pending",
            count:
              Number(metrics.pending_collections) || 0,
          },
          {
            status: "Completed",
            count:
              Number(metrics.completed_collections) || 0,
          },
          {
            status: "Cancelled",
            count:
              Number(metrics.cancelled_collections) || 0,
          },
        ],
      });

      return;
    }

    setError(
      "You do not have permission to view reports."
    );
  } catch (requestError) {
    console.error(
      "Reports request failed:",
      requestError
    );

    setError(
      getErrorMessage(requestError)
    );
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    loadReport();
  }, [range]);

  

  const summary = report?.summary || {};
  const collectionTrend = report?.collection_trend || [];
  const revenueTrend = report?.revenue_trend || [];
  const wasteDistribution = report?.waste_distribution || [];
  const userDistribution = report?.user_distribution || [];
  const pickupStatus = report?.pickup_status_distribution || [];

  const topWasteCategories = useMemo(() => {
    return [...wasteDistribution]
      .sort(
        (a, b) =>
          Number(b.weight_kg || 0) -
          Number(a.weight_kg || 0)
      )
      .slice(0, 5);
  }, [wasteDistribution]);

  function exportSummary() {
    downloadCsv("smartwaste-summary-report.csv", [
      {
        period_days: range,
        total_users: summary.total_users || 0,
        total_pickups: summary.total_pickups || 0,
        completed_pickups: summary.completed_pickups || 0,
        total_weight_kg: summary.total_weight_kg || 0,
        recycling_rate: summary.recycling_rate || 0,
        total_revenue: summary.total_revenue || 0,
        completion_rate: summary.completion_rate || 0,
      },
    ]);
  }

  function exportCollections() {
    downloadCsv(
      "smartwaste-collection-trend.csv",
      collectionTrend
    );
  }

  return (
    <section className="reports-page">
      <header className="reports-heading">
        <div>
          <span className="reports-kicker">
            <BarChart3 size={17} />
            Analytics
          </span>

          <h1>Operational Performance</h1>

          <p>
            Review operational performance, revenue, recycling, and collection trends.
          </p>
        </div>

        <div className="reports-heading-actions">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>

          <button
            type="button"
            className="reports-secondary-btn"
            onClick={loadReport}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="reports-primary-btn"
            onClick={exportSummary}
            disabled={!report}
          >
            <Download size={17} />
            Export Summary
          </button>
        </div>
      </header>

      {error && (
        <div className="reports-feedback error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="reports-summary-grid">
        <article>
          <div className="reports-summary-icon">
            <Truck size={20} />
          </div>
          <div>
            <span>Total Pickups</span>
            <strong>{formatNumber(summary.total_pickups)}</strong>
            <small>
              {formatNumber(summary.completed_pickups)} completed
            </small>
          </div>
        </article>

        <article>
          <div className="reports-summary-icon">
            <TrendingUp size={20} />
          </div>
          <div>
            <span>Completion Rate</span>
            <strong>
              {formatNumber(summary.completion_rate, 1)}%
            </strong>
            <small>Completed collection requests</small>
          </div>
        </article>

        <article>
          <div className="reports-summary-icon">
            <Leaf size={20} />
          </div>
          <div>
            <span>Recycling Rate</span>
            <strong>
              {formatNumber(summary.recycling_rate, 1)}%
            </strong>
            <small>
              {formatNumber(summary.total_weight_kg, 1)} kg collected
            </small>
          </div>
        </article>

        <article>
          <div className="reports-summary-icon">
            <FileText size={20} />
          </div>
          <div>
            <span>Total Revenue</span>
            <strong>
              {formatCurrency(summary.total_revenue)}
            </strong>
            <small>Paid invoices within period</small>
          </div>
        </article>

        <article>
          <div className="reports-summary-icon">
            <Users size={20} />
          </div>
          <div>
            <span>Total Users</span>
            <strong>{formatNumber(summary.total_users)}</strong>
            <small>
              {formatNumber(summary.active_users)} active
            </small>
          </div>
        </article>
      </section>

      <section className="reports-chart-grid">
        <article className="reports-card wide">
          <div className="reports-card-heading">
            <div>
              <h2>Collection Trend</h2>
              <p>Pickup requests created during the period</p>
            </div>

            <button
              type="button"
              className="reports-link-btn"
              onClick={exportCollections}
              disabled={!collectionTrend.length}
            >
              <Download size={16} />
              CSV
            </button>
          </div>

          <div className="reports-chart">
            {loading ? (
              <div className="reports-empty">
                Loading collection trend...
              </div>
            ) : collectionTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={collectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="collections"
                    stroke="#1fa54b"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="reports-empty">
                No collection data available.
              </div>
            )}
          </div>
        </article>

        <article className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>Revenue Trend</h2>
              <p>Paid invoice value by period</p>
            </div>
          </div>

          <div className="reports-chart">
            {loading ? (
              <div className="reports-empty">
                Loading revenue trend...
              </div>
            ) : revenueTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#1fa54b"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="reports-empty">
                No revenue data available.
              </div>
            )}
          </div>
        </article>

        <article className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>Pickup Status</h2>
              <p>Distribution by current status</p>
            </div>
          </div>

          <div className="reports-chart">
            {loading ? (
              <div className="reports-empty">
                Loading pickup statuses...
              </div>
            ) : pickupStatus.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pickupStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label
                  >
                    {pickupStatus.map((entry, index) => (
                      <Cell
                        key={`${entry.status}-${index}`}
                        fill={[
                          "#1fa54b",
                          "#4f77d8",
                          "#f2a93b",
                          "#d85c5c",
                          "#6c7a89",
                          "#9b6fd3",
                        ][index % 6]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="reports-empty">
                No pickup status data available.
              </div>
            )}
          </div>
        </article>

        <article className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>User Distribution</h2>
              <p>Registered users by role</p>
            </div>
          </div>

          <div className="reports-chart">
            {loading ? (
              <div className="reports-empty">
                Loading user distribution...
              </div>
            ) : userDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#4f77d8"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="reports-empty">
                No user data available.
              </div>
            )}
          </div>
        </article>

        <article className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>Top Waste Categories</h2>
              <p>Highest collected weight</p>
            </div>
          </div>

          <div className="reports-ranking">
            {topWasteCategories.length ? (
              topWasteCategories.map((item, index) => (
                <div key={item.category}>
                  <span className="reports-rank">
                    {index + 1}
                  </span>

                  <div>
                    <strong>{item.category}</strong>
                    <small>
                      {formatNumber(item.weight_kg, 1)} kg
                    </small>
                  </div>

                  <div className="reports-progress">
                    <span
                      style={{
                        width: `${
                          topWasteCategories[0]?.weight_kg
                            ? Math.max(
                                8,
                                (Number(item.weight_kg) /
                                  Number(
                                    topWasteCategories[0].weight_kg
                                  )) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="reports-empty">
                No waste category data available.
              </div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}