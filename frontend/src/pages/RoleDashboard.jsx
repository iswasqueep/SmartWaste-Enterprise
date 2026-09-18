import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  Clock,
  Package,
  Truck,
  CheckCircle2,
  FileText,
  Gift,
  Recycle,
  Power,
  MapPin,
  CreditCard,
  AlertTriangle,
  Users,
  BarChart3,
  Layers,
  XCircle,
  RefreshCw,
  ClipboardList,
  X,
} from "lucide-react";

import api from "../api";
import "../styles/recycling.css";

/*
|--------------------------------------------------------------------------
| Dashboard content by role
|--------------------------------------------------------------------------
*/

const dashboardContent = {
  customer: {
    title:
      "Schedule, monitor and pay for waste collections from one place.",
    actions: [
      {
        label: "Request pickup",
        path: "/pickup-request",
        icon: <Truck size={24} />,
      },
      {
        label: "Track pickup",
        path: "/my-pickups",
        icon: <MapPin size={24} />,
      },
      {
        label: "Pay invoice",
        path: "/payments",
        icon: <CreditCard size={24} />,
      },
      {
        label: "Report issue",
        path: "/complaints",
        icon: <AlertTriangle size={24} />,
      },
    ],
  },

  collector: {
    title:
      "Manage assigned jobs and update pickups from acceptance to completion.",
    actions: [
      {
        label: "Assigned Jobs",
        path: "/collector/pickups",
        icon: <Package size={24} />,
      },
      {
        label: "Completed History",
        path: "/collector/pickups?status=completed",
        icon: <CheckCircle2 size={24} />,
      },
      {
        label: "All Requests",
        path: "/requests",
        icon: <FileText size={24} />,
      },
    ],
  },

  recycling_company: {
    title:
      "Track recyclable waste intake, transactions and environmental impact.",
    actions: [
      {
        label: "Waste & Recycling Operations",
        path: "/recycling",
        icon: <Recycle size={24} />,
      },
    ],
  },

  admin: {
    title:
      "Manage operations, users, vehicles and system reporting.",
    actions: [
      {
        label: "User Approvals",
        path: "/users",
        icon: <Users size={24} />,
      },
      {
        label: "Pickup Assignment",
        path: "/requests",
        icon: <Truck size={24} />,
      },
      {
        label: "Waste & Recycling",
        path: "/recycling",
        icon: <Layers size={24} />,
      },
      {
        label: "System Reports",
        path: "/reports",
        icon: <BarChart3 size={24} />,
      },
    ],
  },
  government: {
    title:
      "Monitor waste management, collection performance and recycling activities across the system.",
    actions: [
      {
        label: "Recycling Monitoring",
        path: "/recycling",
        icon: <Recycle size={24} />,
      },
      {
        label: "Environmental Reports",
        path: "/reports",
        icon: <BarChart3 size={24} />,
      },
    ],
  },
};

/*
|--------------------------------------------------------------------------
| Default recycling statistics
|--------------------------------------------------------------------------
*/

const EMPTY_RECYCLING_STATS = {
  total_received_kg: 0,
  total_processed_kg: 0,
  pending_processing_kg: 0,
  total_categories: 0,
  total_batches: 0,
  received_batches: 0,
  processing_batches: 0,
  completed_batches: 0,
  rejected_batches: 0,
  recovery_rate: 0,
  incoming_count: 0,
  incoming_weight_kg: 0,
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatKg(value) {
  const number = Number(value || 0);

  return `${number.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-NG");
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

/*
|--------------------------------------------------------------------------
| Main Dashboard
|--------------------------------------------------------------------------
*/

export default function RoleDashboard() {
  /*
  |--------------------------------------------------------------------------
  | Collector state
  |--------------------------------------------------------------------------
  */

  const [collectorStats, setCollectorStats] = useState({
    assigned: 0,
    accepted: 0,
    en_route: 0,
    completed: 0,
    availability: "available",
  });

  /*
  |--------------------------------------------------------------------------
  | Recycling company state
  |--------------------------------------------------------------------------
  */

  const [recyclingStats, setRecyclingStats] = useState(
    EMPTY_RECYCLING_STATS
  );

  /*
  |--------------------------------------------------------------------------
  | Government state
  |--------------------------------------------------------------------------
  */

  const EMPTY_GOVERNMENT_STATS = {
    total_collections: 0,
    pending_collections: 0,
    completed_collections: 0,
    total_estimated_weight: 0,
    total_actual_weight: 0,
    recyclable_weight: 0,
    recycling_rate: 0,
    active_collectors: 0,
    recycling_companies: 0,
  };

  const [governmentStats, setGovernmentStats] = useState(
    EMPTY_GOVERNMENT_STATS
  );

  const [refreshingGovernment, setRefreshingGovernment] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | General state
  |--------------------------------------------------------------------------
  */

  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [refreshingRecycling, setRefreshingRecycling] =
    useState(false);

  const [error, setError] = useState("");
  const [greeting, setGreeting] = useState("GOOD DAY");

  /*
  |--------------------------------------------------------------------------
  | Get logged-in user
  |--------------------------------------------------------------------------
  */

  let user = {};

  try {
    user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    user = {};
  }

  const role = user.role || "customer";

  const content =
    dashboardContent[role] ||
    dashboardContent.customer;

  /*
  |--------------------------------------------------------------------------
  | Greeting
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      setGreeting("GOOD MORNING");
    } else if (hour < 17) {
      setGreeting("GOOD AFTERNOON");
    } else {
      setGreeting("GOOD EVENING");
    }
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Collector dashboard
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (role !== "collector") {
      return;
    }

    async function loadCollectorDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          "/collector/dashboard"
        );

        const data = response.data || {};

        if (
          Array.isArray(data.pickups) ||
          Array.isArray(data)
        ) {
          const list = Array.isArray(data)
            ? data
            : data.pickups;

          setCollectorStats({
            assigned: list.filter(
              (p) => p.status === "assigned"
            ).length,

            accepted: list.filter(
              (p) => p.status === "accepted"
            ).length,

            en_route: list.filter(
              (p) => p.status === "en_route"
            ).length,

            completed: list.filter(
              (p) =>
                p.status === "completed" ||
                p.status === "collected"
            ).length,

            availability:
              data.availability ||
              data.profile?.availability_status ||
              "available",
          });
        } else {
          setCollectorStats({
            assigned: data.assigned ?? 0,
            accepted: data.accepted ?? 0,
            en_route:
              data.en_route ??
              data.enRoute ??
              0,
            completed: data.completed ?? 0,
            availability:
              data.availability ||
              data.profile?.availability_status ||
              "available",
          });
        }
      } catch (requestError) {
        console.error(
          "Unable to load collector dashboard:",
          requestError
        );

        setError(
          requestError?.response?.data?.error ||
            requestError?.response?.data?.message ||
            "Unable to load collector dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCollectorDashboard();
  }, [role]);

  /*
  |--------------------------------------------------------------------------
  | Recycling company dashboard
  |--------------------------------------------------------------------------
  */

  async function loadRecyclingDashboard(
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshingRecycling(true);
      } else {
        setLoading(true);
      }

      setError("");

      console.log(
        "Loading recycling company dashboard..."
      );

      const response = await api.get(
        "/recycling/dashboard"
      );

      console.log(
        "RECYCLING DASHBOARD RESPONSE:",
        response.data
      );

      const data = response.data || {};

      /*
      Backend returns the statistics directly:
      
      {
        total_received_kg,
        total_processed_kg,
        pending_processing_kg,
        total_categories,
        total_batches,
        received_batches,
        processing_batches,
        completed_batches,
        rejected_batches,
        recovery_rate,
        incoming_count,
        incoming_weight_kg
      }

      We also support a nested "dashboard" response
      in case the API is changed later.
      */

      const stats =
        data.dashboard || data;

      setRecyclingStats({
        total_received_kg:
          Number(
            stats.total_received_kg
          ) || 0,

        total_processed_kg:
          Number(
            stats.total_processed_kg
          ) || 0,

        pending_processing_kg:
          Number(
            stats.pending_processing_kg
          ) || 0,

        total_categories:
          Number(
            stats.total_categories
          ) || 0,

        total_batches:
          Number(
            stats.total_batches
          ) || 0,

        received_batches:
          Number(
            stats.received_batches
          ) || 0,

        processing_batches:
          Number(
            stats.processing_batches
          ) || 0,

        completed_batches:
          Number(
            stats.completed_batches
          ) || 0,

        rejected_batches:
          Number(
            stats.rejected_batches
          ) || 0,

        recovery_rate:
          Number(
            stats.recovery_rate
          ) || 0,

        incoming_count:
          Number(
            stats.incoming_count
          ) || 0,

        incoming_weight_kg:
          Number(
            stats.incoming_weight_kg
          ) || 0,
      });
    } catch (requestError) {
      console.error(
        "Unable to load recycling dashboard:",
        requestError
      );

      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Unable to load recycling dashboard."
      );

      /*
      Do not show fake values if the API fails.
      */

      setRecyclingStats(
        EMPTY_RECYCLING_STATS
      );
    } finally {
      setLoading(false);
      setRefreshingRecycling(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Load recycling dashboard
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (role !== "recycling_company") {
      return;
    }

    loadRecyclingDashboard();
  }, [role]);

  /*
  |--------------------------------------------------------------------------
  | Government dashboard
  |--------------------------------------------------------------------------
  */

  async function loadGovernmentDashboard(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshingGovernment(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get(
        "/government/dashboard"
      );

      const data = response.data || {};
      const metrics = data.metrics || {};

      setGovernmentStats({
        total_collections:
          Number(metrics.total_collections) || 0,
        pending_collections:
          Number(metrics.pending_collections) || 0,
        completed_collections:
          Number(metrics.completed_collections) || 0,
        total_estimated_weight:
          Number(metrics.total_estimated_weight) || 0,
        total_actual_weight:
          Number(metrics.total_actual_weight) || 0,
        recyclable_weight:
          Number(metrics.recyclable_weight) || 0,
        recycling_rate:
          Number(metrics.recycling_rate) || 0,
        active_collectors:
          Number(metrics.active_collectors) || 0,
        recycling_companies:
          Number(metrics.recycling_companies) || 0,
      });
    } catch (requestError) {
      console.error(
        "Unable to load government dashboard:",
        requestError
      );

      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Unable to load government dashboard."
      );

      setGovernmentStats(EMPTY_GOVERNMENT_STATS);
    } finally {
      setLoading(false);
      setRefreshingGovernment(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Load government dashboard
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (role !== "government") {
      return;
    }

    loadGovernmentDashboard();
  }, [role]);

  /*
  |--------------------------------------------------------------------------
  | Collector availability
  |--------------------------------------------------------------------------
  */

  const toggleAvailability = async () => {
    const nextStatus =
      collectorStats.availability === "available"
        ? "unavailable"
        : "available";

    try {
      setUpdatingStatus(true);
      setError("");

      await api.patch(
        "/collector/availability",
        {
          availability_status: nextStatus,
        }
      );

      setCollectorStats(
        (previous) => ({
          ...previous,
          availability:
            nextStatus,
        })
      );
    } catch (requestError) {
      console.error(
        "Failed to update availability:",
        requestError
      );

      setError(
        requestError?.response?.data?.error ||
          "Unable to update availability."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const isAvailable =
    collectorStats.availability ===
      "assigned" ||
    collectorStats.availability ===
      "available" ||
    !collectorStats.availability;

  /*
  |--------------------------------------------------------------------------
  | Role-specific statistics
  |--------------------------------------------------------------------------
  */

  let displayStats = [];

  /*
  |--------------------------------------------------------------------------
  | Collector
  |--------------------------------------------------------------------------
  */

  if (role === "collector") {
    displayStats = [
      {
        label: "Assigned Jobs",
        value: loading
          ? "..."
          : collectorStats.assigned,
        subtext:
          "Waiting for acceptance",
        icon: <Clock size={20} />,
        color: "blue",
      },

      {
        label: "Accepted",
        value: loading
          ? "..."
          : collectorStats.accepted,
        subtext:
          "Ready for pickup",
        icon: <Package size={20} />,
        color: "orange",
      },

      {
        label: "En Route",
        value: loading
          ? "..."
          : collectorStats.en_route,
        subtext:
          "Currently driving",
        icon: <Truck size={20} />,
        color: "purple",
      },

      {
        label: "Completed",
        value: loading
          ? "..."
          : collectorStats.completed,
        subtext:
          "Successfully collected",
        icon: <CheckCircle2 size={20} />,
        color: "green",
      },
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | Recycling company
  |--------------------------------------------------------------------------
  */

  else if (
    role === "recycling_company"
  ) {
    displayStats = [
      {
        label: "Recyclable Intake",
        value: refreshingRecycling
          ? "..."
          : formatKg(
              recyclingStats.total_received_kg
            ),
        subtext:
          "Total recyclable material received",
        icon: <Recycle size={20} />,
        color: "green",
      },

      {
        label: "Incoming Waste",
        value: refreshingRecycling
          ? "..."
          : formatKg(
              recyclingStats.incoming_weight_kg
            ),
        subtext: `${formatNumber(
          recyclingStats.incoming_count
        )} collected pickups awaiting intake`,
        icon: <Truck size={20} />,
        color: "blue",
      },

      {
        label: "Processing",
        value: refreshingRecycling
          ? "..."
          : formatKg(
              recyclingStats.pending_processing_kg
            ),
        subtext: `${formatNumber(
          recyclingStats.processing_batches
        )} batches currently processing`,
        icon: <Package size={20} />,
        color: "purple",
      },

      {
        label: "Recovery Rate",
        value: refreshingRecycling
          ? "..."
          : formatPercentage(
              recyclingStats.recovery_rate
            ),
        subtext: `${formatNumber(
          recyclingStats.completed_batches
        )} completed batches`,
        icon: <CheckCircle2 size={20} />,
        color: "orange",
      },
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | Government
  |--------------------------------------------------------------------------
  */

  else if (role === "government") {
    displayStats = [
      {
        label: "Total Collections",
        value: refreshingGovernment
          ? "..."
          : formatNumber(
              governmentStats.total_collections
            ),
        subtext: "All waste collection requests",
        icon: <ClipboardList size={20} />,
        color: "blue",
      },
      {
        label: "Pending Collections",
        value: refreshingGovernment
          ? "..."
          : formatNumber(
              governmentStats.pending_collections
            ),
        subtext: "Pending or currently in progress",
        icon: <Clock size={20} />,
        color: "orange",
      },
      {
        label: "Completed Collections",
        value: refreshingGovernment
          ? "..."
          : formatNumber(
              governmentStats.completed_collections
            ),
        subtext: "Successfully completed",
        icon: <CheckCircle2 size={20} />,
        color: "green",
      },
      {
        label: "Recycling Rate",
        value: refreshingGovernment
          ? "..."
          : formatPercentage(
              governmentStats.recycling_rate
            ),
        subtext: "Recyclable material against actual waste",
        icon: <Recycle size={20} />,
        color: "purple",
      },
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | Customer / fallback
  |--------------------------------------------------------------------------
  */

  else {
    displayStats = [
      {
        label: "Active pickups",
        value: "3",
        subtext:
          "Pending or in progress",
        icon: <Clock size={20} />,
        color: "orange",
      },

      {
        label: "Completed pickups",
        value: "2",
        subtext:
          "Successfully collected",
        icon: <Package size={20} />,
        color: "green",
      },

      {
        label: "Outstanding invoices",
        value: "₦731",
        subtext:
          "1 invoice(s) pending",
        icon: <FileText size={20} />,
        color: "blue",
      },

      {
        label: "Reward points",
        value: "0 pts",
        subtext:
          "Earned from recycling",
        icon: <Gift size={20} />,
        color: "purple",
      },
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="recycling-dashboard-container animate-fade-in">

      {/* =====================================================
          WELCOME BANNER
      ====================================================== */}

      <header className="welcome-banner">
        <div className="banner-text">

          <p className="kicker-text">
            {greeting}
          </p>

          <h1>
            Welcome back,{" "}
            {user.full_name || "Oluwole"}
          </h1>

          <p className="subtitle-text">
            {content.title}
          </p>

          {role === "collector" && (
            <button
              type="button"
              onClick={toggleAvailability}
              disabled={
                updatingStatus
              }
              className={`duty-toggle-btn ${
                isAvailable
                  ? "btn-danger"
                  : "btn-light"
              }`}
            >
              <Power
                size={16}
                className={
                  updatingStatus
                    ? "animate-spin"
                    : ""
                }
              />

              {updatingStatus
                ? "Updating..."
                : isAvailable
                ? "Go Off-Duty"
                : "Go On-Duty"}
            </button>
          )}

          {role ===
            "recycling_company" && (
            <button
              type="button"
              className="duty-toggle-btn btn-light"
              onClick={() =>
                loadRecyclingDashboard(
                  true
                )
              }
              disabled={
                refreshingRecycling
              }
            >
              <RefreshCw
                size={16}
                className={
                  refreshingRecycling
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshingRecycling
                ? "Refreshing..."
                : "Refresh Data"}
            </button>
          )}
        </div>

          {role === "government" && (
            <button
              type="button"
              className="duty-toggle-btn btn-light"
              onClick={() =>
                loadGovernmentDashboard(true)
              }
              disabled={refreshingGovernment}
            >
              <RefreshCw
                size={16}
                className={
                  refreshingGovernment
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshingGovernment
                ? "Refreshing..."
                : "Refresh Data"}
            </button>
          )}

        <div className="banner-icon-wrapper">
          <Recycle
            size={56}
            color="#ffffff"
            strokeWidth={1.5}
          />
        </div>
      </header>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px 18px",
            borderRadius: "12px",
            background: "#fff4f4",
            color: "#b42318",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={20} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* =====================================================
          STATISTICS
      ====================================================== */}

      <div className="stat-cards-grid">
        {displayStats.map(
          (stat, index) => (
            <div
              className="stat-card"
              key={`${stat.label}-${index}`}
            >
              <div
                className={`stat-icon-wrapper bg-${stat.color}-light`}
              >
                {stat.icon}
              </div>

              <div className="stat-content">

                <p className="stat-label">
                  {stat.label}
                </p>

                <h3 className="stat-value">
                  {stat.value}
                </h3>

                <p className="stat-subtext">
                  {stat.subtext}
                </p>

              </div>
            </div>
          )
        )}
      </div>

      {/* =====================================================
          RECYCLING COMPANY EXTRA INFORMATION
      ====================================================== */}

      {role ===
        "recycling_company" && (
        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div className="section-header">
            <p className="section-kicker">
              RECYCLING OPERATIONS
            </p>

            <h2 className="section-title">
              Processing overview
            </h2>
          </div>

          <div className="stat-cards-grid">

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-blue-light">
                <Layers size={20} />
              </div>

              <div className="stat-content">
                <p className="stat-label">
                  Total Batches
                </p>

                <h3 className="stat-value">
                  {formatNumber(
                    recyclingStats.total_batches
                  )}
                </h3>

                <p className="stat-subtext">
                  All registered recycling batches
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-orange-light">
                <Clock size={20} />
              </div>

              <div className="stat-content">
                <p className="stat-label">
                  Received Batches
                </p>

                <h3 className="stat-value">
                  {formatNumber(
                    recyclingStats.received_batches
                  )}
                </h3>

                <p className="stat-subtext">
                  Awaiting processing
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-purple-light">
                <Package size={20} />
              </div>

              <div className="stat-content">
                <p className="stat-label">
                  Processing Batches
                </p>

                <h3 className="stat-value">
                  {formatNumber(
                    recyclingStats.processing_batches
                  )}
                </h3>

                <p className="stat-subtext">
                  Currently being processed
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-green-light">
                <CheckCircle2 size={20} />
              </div>

              <div className="stat-content">
                <p className="stat-label">
                  Completed Batches
                </p>

                <h3 className="stat-value">
                  {formatNumber(
                    recyclingStats.completed_batches
                  )}
                </h3>

                <p className="stat-subtext">
                  Successfully processed
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-orange-light">
                <XCircle size={20} />
              </div>

              <div className="stat-content">
                <p className="stat-label">
                  Rejected Batches
                </p>

                <h3 className="stat-value">
                  {formatNumber(
                    recyclingStats.rejected_batches
                  )}
                </h3>

                <p className="stat-subtext">
                  Rejected recycling batches
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-green-light">
                <Recycle size={20} />
              </div>

              <div className="stat-content">
                <p className="stat-label">
                  Processed Weight
                </p>

                <h3 className="stat-value">
                  {formatKg(
                    recyclingStats.total_processed_kg
                  )}
                </h3>

                <p className="stat-subtext">
                  Total material processed
                </p>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* =====================================================
          GOVERNMENT OVERSIGHT
      ====================================================== */}

      {role === "government" && (
        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div className="section-header">
            <p className="section-kicker">
              GOVERNMENT OVERSIGHT
            </p>

            <h2 className="section-title">
              Waste management overview
            </h2>
          </div>

          <div className="stat-cards-grid">
            <div className="stat-card">
              <div className="stat-icon-wrapper bg-blue-light">
                <Truck size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label">
                  Actual Waste Collected
                </p>
                <h3 className="stat-value">
                  {refreshingGovernment
                    ? "..."
                    : formatKg(
                        governmentStats.total_actual_weight
                      )}
                </h3>
                <p className="stat-subtext">
                  Recorded collection weight
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-green-light">
                <Recycle size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label">
                  Recyclable Material
                </p>
                <h3 className="stat-value">
                  {refreshingGovernment
                    ? "..."
                    : formatKg(
                        governmentStats.recyclable_weight
                      )}
                </h3>
                <p className="stat-subtext">
                  Material received for recycling
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-purple-light">
                <Users size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label">
                  Active Collectors
                </p>
                <h3 className="stat-value">
                  {refreshingGovernment
                    ? "..."
                    : formatNumber(
                        governmentStats.active_collectors
                      )}
                </h3>
                <p className="stat-subtext">
                  Approved and active collectors
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-orange-light">
                <Layers size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label">
                  Recycling Companies
                </p>
                <h3 className="stat-value">
                  {refreshingGovernment
                    ? "..."
                    : formatNumber(
                        governmentStats.recycling_companies
                      )}
                </h3>
                <p className="stat-subtext">
                  Approved active recycling companies
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-blue-light">
                <Package size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label">
                  Estimated Waste
                </p>
                <h3 className="stat-value">
                  {refreshingGovernment
                    ? "..."
                    : formatKg(
                        governmentStats.total_estimated_weight
                      )}
                </h3>
                <p className="stat-subtext">
                  Total estimated collection weight
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper bg-green-light">
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label">
                  Completion Rate
                </p>
                <h3 className="stat-value">
                  {refreshingGovernment
                    ? "..."
                    : formatPercentage(
                        governmentStats.total_collections
                          ? (
                              governmentStats.completed_collections /
                              governmentStats.total_collections
                            ) * 100
                          : 0
                      )}
                </h3>
                <p className="stat-subtext">
                  Completed collection requests
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          QUICK ACTIONS
      ====================================================== */}

      <section className="quick-actions-section">

        <div className="section-header">

          <p className="section-kicker">
            GET THINGS DONE
          </p>

          <h2 className="section-title">
            Quick actions
          </h2>

        </div>

        <div className="action-cards-grid">

          {content.actions.map(
            (action, index) => (
              <Link
                key={`${action.label}-${index}`}
                to={action.path}
                className="action-card"
              >
                <div className="action-icon-box">
                  {action.icon}
                </div>

                <h4>
                  {action.label}
                </h4>
              </Link>
            )
          )}

        </div>

      </section>
    </div>
  );
}