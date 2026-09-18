import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Factory,
  RefreshCw,
  Recycle,
  Scale,
  Truck,
} from "lucide-react";

import api from "../api";
import "../styles/government.css";


const EMPTY_METRICS = {
  total_collections: 0,
  pending_collections: 0,
  completed_collections: 0,
  cancelled_collections: 0,
  total_estimated_weight: 0,
  total_actual_weight: 0,
  recyclable_weight: 0,
  recycling_rate: 0,
  completion_rate: 0,
  active_collectors: 0,
  recycling_companies: 0,
};


function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
}


function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-NG");
}


function formatKg(value) {
  return `${Number(value || 0).toLocaleString(
    "en-NG",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )} kg`;
}


function formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}


function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
}) {
  return (
    <article className="government-stat-card">
      <div
        className={`government-stat-icon government-stat-icon--${tone}`}
      >
        <Icon size={22} />
      </div>

      <div className="government-stat-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{caption}</p>
      </div>
    </article>
  );
}


export default function GovernmentDashboard() {
  const user = getStoredUser();

  const [metrics, setMetrics] = useState(
    EMPTY_METRICS
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      try {
        setError("");

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await api.get(
          "/government/dashboard"
        );

        const incoming =
          response?.data?.metrics || {};

        setMetrics({
          total_collections:
            Number(
              incoming.total_collections
            ) || 0,

          pending_collections:
            Number(
              incoming.pending_collections
            ) || 0,

          completed_collections:
            Number(
              incoming.completed_collections
            ) || 0,

          cancelled_collections:
            Number(
              incoming.cancelled_collections
            ) || 0,

          total_estimated_weight:
            Number(
              incoming.total_estimated_weight
            ) || 0,

          total_actual_weight:
            Number(
              incoming.total_actual_weight
            ) || 0,

          recyclable_weight:
            Number(
              incoming.recyclable_weight
            ) || 0,

          recycling_rate:
            Number(
              incoming.recycling_rate
            ) || 0,

          completion_rate:
            Number(
              incoming.completion_rate
            ) || 0,

          active_collectors:
            Number(
              incoming.active_collectors
            ) || 0,

          recycling_companies:
            Number(
              incoming.recycling_companies
            ) || 0,
        });
      } catch (requestError) {
        console.error(
          "Unable to load government dashboard:",
          requestError
        );

        setMetrics(EMPTY_METRICS);

        setError(
          requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Unable to load government dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);


  const display = (value, formatter) => {
    if (loading && !refreshing) {
      return "...";
    }

    return formatter(value);
  };


  return (
    <main className="government-page">
      <div className="government-page-inner">

        <div className="government-header">
          <div>
            <p className="government-kicker">
              GOVERNMENT OVERSIGHT
            </p>

            <h1>
              Waste Management Oversight
            </h1>

            <p className="government-description">
              Monitor collection activity, recycling
              performance and environmental operations
              across SmartWaste.
            </p>
          </div>

          <button
            type="button"
            className="government-refresh-btn"
            onClick={() => loadDashboard(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "government-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh Data"}
          </button>
        </div>


        {error && (
          <div className="government-alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadDashboard(true)}
            >
              Retry
            </button>
          </div>
        )}


        <section className="government-welcome">
          <div>
            <p>
              {new Date().getHours() < 12
                ? "GOOD MORNING"
                : new Date().getHours() < 17
                ? "GOOD AFTERNOON"
                : "GOOD EVENING"}
            </p>

            <h2>
              Welcome back,{" "}
              {user.full_name ||
                "Government Officer"}
            </h2>

            <span>
              {user.email ||
                "Government Agency"}
            </span>
          </div>

          <div className="government-welcome-icon">
            <BarChart3 size={42} />
          </div>
        </section>


        <section className="government-stat-grid">
          <StatCard
            label="Total Collections"
            value={display(
              metrics.total_collections,
              formatNumber
            )}
            caption="All collection requests"
            icon={ClipboardList}
            tone="blue"
          />

          <StatCard
            label="Pending Collections"
            value={display(
              metrics.pending_collections,
              formatNumber
            )}
            caption="Pending or in progress"
            icon={Clock3}
            tone="orange"
          />

          <StatCard
            label="Completed Collections"
            value={display(
              metrics.completed_collections,
              formatNumber
            )}
            caption="Successfully collected"
            icon={CheckCircle2}
            tone="green"
          />

          <StatCard
            label="Recycling Rate"
            value={display(
              metrics.recycling_rate,
              formatPercentage
            )}
            caption="Recyclable share of completed waste"
            icon={Recycle}
            tone="purple"
          />
        </section>


        <section className="government-section">
          <div className="government-section-heading">
            <div>
              <p>PERFORMANCE</p>
              <h2>Environmental & operational indicators</h2>
            </div>
          </div>

          <div className="government-indicator-grid">

            <article className="government-indicator">
              <div className="government-indicator-icon">
                <Scale size={21} />
              </div>

              <div>
                <span>Actual Waste Collected</span>
                <strong>
                  {display(
                    metrics.total_actual_weight,
                    formatKg
                  )}
                </strong>
                <p>
                  Recorded collection weight
                </p>
              </div>
            </article>


            <article className="government-indicator">
              <div className="government-indicator-icon">
                <Recycle size={21} />
              </div>

              <div>
                <span>Recyclable Material</span>
                <strong>
                  {display(
                    metrics.recyclable_weight,
                    formatKg
                  )}
                </strong>
                <p>
                  Recyclable portion of completed collections
                </p>
              </div>
            </article>


            <article className="government-indicator">
              <div className="government-indicator-icon">
                <Truck size={21} />
              </div>

              <div>
                <span>Active Collectors</span>
                <strong>
                  {display(
                    metrics.active_collectors,
                    formatNumber
                  )}
                </strong>
                <p>
                  Approved active collection personnel
                </p>
              </div>
            </article>


            <article className="government-indicator">
              <div className="government-indicator-icon">
                <Factory size={21} />
              </div>

              <div>
                <span>Recycling Companies</span>
                <strong>
                  {display(
                    metrics.recycling_companies,
                    formatNumber
                  )}
                </strong>
                <p>
                  Active recycling company profiles
                </p>
              </div>
            </article>

          </div>
        </section>


        <section className="government-summary-grid">

          <article className="government-summary-card">
            <div className="government-summary-top">
              <span>Completion Rate</span>
              <CheckCircle2 size={20} />
            </div>

            <strong>
              {display(
                metrics.completion_rate,
                formatPercentage
              )}
            </strong>

            <p>
              Completed collections compared with
              all collection requests.
            </p>
          </article>


          <article className="government-summary-card">
            <div className="government-summary-top">
              <span>Estimated Waste</span>
              <Scale size={20} />
            </div>

            <strong>
              {display(
                metrics.total_estimated_weight,
                formatKg
              )}
            </strong>

            <p>
              Total estimated weight submitted
              through collection requests.
            </p>
          </article>


          <article className="government-summary-card">
            <div className="government-summary-top">
              <span>Cancelled Collections</span>
              <Clock3 size={20} />
            </div>

            <strong>
              {display(
                metrics.cancelled_collections,
                formatNumber
              )}
            </strong>

            <p>
              Collection requests that were cancelled.
            </p>
          </article>

        </section>


        <section className="government-actions">
          <div>
            <p className="government-section-kicker">
              OVERSIGHT TOOLS
            </p>

            <h2>Government resources</h2>
          </div>

          <div className="government-action-grid">
            <a
              href="/reports"
              className="government-action-card"
            >
              <BarChart3 size={23} />
              <div>
                <strong>Environmental Reports</strong>
                <span>
                  Review system reporting and trends.
                </span>
              </div>
            </a>

            <a
              href="/recycling"
              className="government-action-card"
            >
              <Recycle size={23} />
              <div>
                <strong>Recycling Monitoring</strong>
                <span>
                  View recycling performance and batches.
                </span>
              </div>
            </a>
          </div>
        </section>

      </div>
    </main>
  );
}
