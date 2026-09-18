import { useEffect, useMemo, useState } from "react";
import {
  Recycle,
  RefreshCw,
  Package,
  Scale,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ArrowRight,
  Factory,
  X,
  Search,
  AlertCircle,
  Loader2,
} from "lucide-react";

import api from "../api";
import "../styles/recycling.css";

const STATUS_LABELS = {
  received: "Received",
  processing: "Processing",
  processed: "Processed",
  rejected: "Rejected",
  sold: "Sold",
};

function getStoredUser() {
  try {
    const stored = localStorage.getItem("user");

    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch (error) {
    console.error("Unable to read stored user:", error);
    return {};
  }
}

function formatNumber(value, decimals = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return Number(0).toLocaleString("en-NG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return number.toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getWasteCategoryName(category) {
  if (!category) {
    return "—";
  }

  if (typeof category === "string") {
    return category;
  }

  return category.name || "—";
}

function statusLabel(status) {
  return (
    STATUS_LABELS[status] ||
    String(status || "unknown")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  );
}

function statusClass(status) {
  return `recycling-status recycling-status--${
    status || "unknown"
  }`;
}

function getApiError(error, fallback) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = "green",
}) {
  return (
    <article className="recycling-stat-card">
      <div
        className={`recycling-stat-icon recycling-stat-icon--${tone}`}
      >
        <Icon size={22} />
      </div>

      <div>
        <span>{label}</span>

        <strong>{value}</strong>

        <p>{caption}</p>
      </div>
    </article>
  );
}

function EmptyState({
  title,
  text,
  icon: Icon = Package,
}) {
  return (
    <div className="recycling-empty-state">
      <div className="recycling-empty-icon">
        <Icon size={30} />
      </div>

      <h3>{title}</h3>

      <p>{text}</p>
    </div>
  );
}

export default function Recycling() {
  const user = useMemo(
    () => getStoredUser(),
    []
  );

  const role = String(
    user?.role || ""
  )
    .trim()
    .toLowerCase();

  const isCompany =
    role === "recycling_company";

  const isAdmin =
    role === "admin";

  const isGovernment =
    role === "government";

  const canReceive =
    isCompany || isAdmin;

  const canManage =
    isCompany || isAdmin;

  const [dashboard, setDashboard] =
    useState(null);

  const [incoming, setIncoming] =
    useState([]);

  const [batches, setBatches] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [activeTab, setActiveTab] =
    useState(
      isCompany
        ? "incoming"
        : "overview"
    );

  const [search, setSearch] =
    useState("");

  const [selectedPickup, setSelectedPickup] =
    useState(null);

  const [selectedBatch, setSelectedBatch] =
    useState(null);

  const [receiveWeight, setReceiveWeight] =
    useState("");

  const [processingWeight, setProcessingWeight] =
    useState("");

  const [processingStatus, setProcessingStatus] =
    useState("processing");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  /*
   * ----------------------------------------------------------
   * DEBUG ROLE
   * ----------------------------------------------------------
   */

  useEffect(() => {
    console.log(
      "RECYCLING PAGE USER:",
      user
    );

    console.log(
      "RECYCLING PAGE ROLE:",
      role
    );
  }, [user, role]);

  /*
   * ----------------------------------------------------------
   * LOAD DASHBOARD
   * ----------------------------------------------------------
   */

  async function loadDashboard() {
    try {
      const response = await api.get(
        "/recycling/dashboard"
      );

      setDashboard(
        response.data || {}
      );

      return {
        success: true,
      };
    } catch (requestError) {
      console.error(
        "Recycling dashboard request failed:",
        requestError?.response?.status,
        requestError?.response?.data
      );

      throw requestError;
    }
  }

  /*
   * ----------------------------------------------------------
   * LOAD INCOMING MATERIAL
   * ----------------------------------------------------------
   */

  async function loadIncoming() {
    try {
      const response = await api.get(
        "/recycling/incoming"
      );

      console.log(
        "RECYCLING INCOMING RESPONSE:",
        response.data
      );

      const items =
        response.data?.items;

      setIncoming(
        Array.isArray(items)
          ? items
          : []
      );

      return {
        success: true,
      };
    } catch (requestError) {
      console.error(
        "Incoming recycling request failed:",
        requestError?.response?.status,
        requestError?.response?.data
      );

      throw requestError;
    }
  }

  /*
   * ----------------------------------------------------------
   * LOAD RECYCLING BATCHES
   * ----------------------------------------------------------
   */

  async function loadBatches() {
    try {
      const response = await api.get(
        "/recycling/batches"
      );

      console.log(
        "RECYCLING BATCHES RESPONSE:",
        response.data
      );

      const items =
        response.data?.items;

      setBatches(
        Array.isArray(items)
          ? items
          : []
      );

      return {
        success: true,
      };
    } catch (requestError) {
      console.error(
        "Recycling batches request failed:",
        requestError?.response?.status,
        requestError?.response?.data
      );

      throw requestError;
    }
  }

  /*
   * ----------------------------------------------------------
   * LOAD EVERYTHING
   * ----------------------------------------------------------
   */

  async function loadAll(
    showSpinner = true
  ) {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      /*
       * Do these separately instead of Promise.all().
       *
       * This means if dashboard fails, incoming material
       * can still load.
       */

      try {
        await loadDashboard();
      } catch (dashboardError) {
        console.error(
          "Dashboard failed:",
          dashboardError
        );
      }

      try {
        await loadIncoming();
      } catch (incomingError) {
        console.error(
          "Incoming material failed:",
          incomingError
        );

        setError(
          getApiError(
            incomingError,
            "Unable to load incoming recyclable material."
          )
        );
      }

      try {
        await loadBatches();
      } catch (batchError) {
        console.error(
          "Batches failed:",
          batchError
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAll(true);
  }, []);

  /*
   * ----------------------------------------------------------
   * MESSAGE
   * ----------------------------------------------------------
   */

  function showMessage(text) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  /*
   * ----------------------------------------------------------
   * RECEIVE MODAL
   * ----------------------------------------------------------
   */

  function closeReceiveModal() {
    if (saving) {
      return;
    }

    setSelectedPickup(null);
    setReceiveWeight("");
    setNotes("");
    setError("");
  }

  function openReceiveModal(pickup) {
    setSelectedPickup(pickup);

    const weight =
      pickup?.actual_weight ??
      pickup?.weight ??
      pickup?.estimated_weight ??
      "";

    setReceiveWeight(
      weight !== null &&
      weight !== undefined
        ? String(weight)
        : ""
    );

    setNotes("");
    setError("");
  }

  /*
   * ----------------------------------------------------------
   * RECEIVE MATERIAL
   * ----------------------------------------------------------
   */

  async function receiveMaterial() {
    if (!selectedPickup) {
      return;
    }

    if (!canReceive) {
      setError(
        "You do not have permission to receive recyclable material."
      );

      return;
    }

    const weight = Number(
      receiveWeight
    );

    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      setError(
        "Received weight must be greater than zero."
      );

      return;
    }

    const pickupId =
      selectedPickup.pickup_id;

    if (!pickupId) {
      setError(
        "This pickup does not have a valid pickup ID."
      );

      return;
    }

    /*
     * IMPORTANT:
     *
     * Do NOT send recycling_company_id here.
     *
     * The backend must determine the company from
     * the authenticated recycling-company account.
     */

    const payload = {
      pickup_id: pickupId,
      weight_received: weight,
      notes:
        notes.trim() || null,
    };

    console.log(
      "RECEIVING RECYCLABLE MATERIAL:",
      payload
    );

    console.log(
      "CURRENT FRONTEND ROLE:",
      role
    );

    try {
      setSaving(true);
      setError("");

      const response =
        await api.post(
          "/recycling/batches",
          payload
        );

      console.log(
        "RECYCLING BATCH CREATED:",
        response.data
      );

      closeReceiveModal();

      showMessage(
        "Recyclable material received successfully."
      );

      /*
       * Refresh all recycling information.
       */

      await loadAll(false);

      setActiveTab("batches");
    } catch (requestError) {
      console.error(
        "Receive recyclable material failed:",
        requestError
      );

      console.error(
        "HTTP STATUS:",
        requestError?.response?.status
      );

      console.error(
        "SERVER RESPONSE:",
        requestError?.response?.data
      );

      const serverError =
        requestError?.response?.data?.error ||
        requestError?.response?.data?.message;

      setError(
        serverError ||
          "Unable to receive recyclable material."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ----------------------------------------------------------
   * PROCESS MODAL
   * ----------------------------------------------------------
   */

  function openProcessModal(batch) {
    setSelectedBatch(batch);

    setProcessingWeight(
      batch?.weight_processed != null
        ? String(
            batch.weight_processed
          )
        : ""
    );

    setProcessingStatus(
      batch?.status === "received"
        ? "processing"
        : batch?.status ||
            "processing"
    );

    setNotes(
      batch?.notes || ""
    );

    setError("");
  }

  function closeProcessModal() {
    if (saving) {
      return;
    }

    setSelectedBatch(null);
    setProcessingWeight("");
    setProcessingStatus(
      "processing"
    );
    setNotes("");
    setError("");
  }

  /*
   * ----------------------------------------------------------
   * UPDATE BATCH
   * ----------------------------------------------------------
   */

  async function updateBatch() {
    if (!selectedBatch) {
      return;
    }

    const payload = {
      status: processingStatus,
      notes:
        notes.trim() || null,
    };

    if (
      processingWeight !== ""
    ) {
      const weight = Number(
        processingWeight
      );

      if (
        !Number.isFinite(weight) ||
        weight < 0
      ) {
        setError(
          "Processed weight must be a valid number."
        );

        return;
      }

      payload.weight_processed =
        weight;
    }

    if (
      processingStatus ===
        "processed" &&
      payload.weight_processed ==
        null
    ) {
      setError(
        "Processed weight is required before completing a batch."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.patch(
        `/recycling/batches/${selectedBatch.id}`,
        payload
      );

      closeProcessModal();

      showMessage(
        "Recycling batch updated successfully."
      );

      await loadAll(false);
    } catch (requestError) {
      console.error(
        "Batch update failed:",
        requestError
      );

      setError(
        getApiError(
          requestError,
          "Unable to update recycling batch."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ----------------------------------------------------------
   * FILTER INCOMING
   * ----------------------------------------------------------
   */

  const filteredIncoming =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return incoming;
      }

      return incoming.filter(
        (item) => {
          const values = [
            item.reference,
            item.customer,
            item.waste_category,
            item.status,
          ];

          return values
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            );
        }
      );
    }, [
      incoming,
      search,
    ]);

  /*
   * ----------------------------------------------------------
   * FILTER BATCHES
   * ----------------------------------------------------------
   */

  const filteredBatches =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return batches;
      }

      return batches.filter(
        (batch) => {
          const material =
            getWasteCategoryName(
              batch.waste_category
            );

          const values = [
            batch.id,
            batch.pickup_reference,
            batch.reference,
            material,
            batch.status,
          ];

          return values
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            );
        }
      );
    }, [
      batches,
      search,
    ]);

  /*
   * ----------------------------------------------------------
   * DASHBOARD STATS
   * ----------------------------------------------------------
   */

  const stats = {
    total_batches:
      Number(
        dashboard?.total_batches ??
          dashboard?.total_recycling_batches ??
          batches.length ??
          0
      ),

    incoming_count:
      Number(
        dashboard?.incoming_count ??
          incoming.length ??
          0
      ),

    incoming_weight_kg:
      Number(
        dashboard?.incoming_weight_kg ??
          0
      ),

    received_batches:
      Number(
        dashboard?.received_batches ??
          0
      ),

    processing_batches:
      Number(
        dashboard?.processing_batches ??
          0
      ),

    completed_batches:
      Number(
        dashboard?.completed_batches ??
          0
      ),

    rejected_batches:
      Number(
        dashboard?.rejected_batches ??
          0
      ),

    total_received_kg:
      Number(
        dashboard?.total_received_kg ??
          0
      ),

    total_processed_kg:
      Number(
        dashboard?.total_processed_kg ??
          0
      ),

    recovery_rate:
      Number(
        dashboard?.recovery_rate ??
          0
      ),
  };

  /*
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */

  if (loading) {
    return (
      <main className="recycling-page">
        <div className="recycling-loading">
          <RefreshCw
            size={24}
            className="spin"
          />

          <span>
            Loading recycling operations...
          </span>
        </div>
      </main>
    );
  }

  /*
   * ----------------------------------------------------------
   * PAGE
   * ----------------------------------------------------------
   */

  return (
    <main className="recycling-page animate-fade-in">

      {/* HEADER */}
      <header className="recycling-heading">
        <div>
          <span className="recycling-kicker">
            <Recycle size={16} />

            Waste operations
          </span>

          <h1>
            Recycling Management
          </h1>

          <p>
            Track incoming recyclable
            material, manage recycling
            batches and monitor processing
            performance.
          </p>
        </div>

        <div className="recycling-heading-actions">
          <button
            type="button"
            className="recycling-secondary-btn"
            onClick={() =>
              loadAll(false)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div className="recycling-alert recycling-alert--error">
          <AlertCircle
            size={18}
          />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUCCESS */}
      {message && (
        <div className="recycling-alert recycling-alert--success">
          <CheckCircle2
            size={18}
          />

          <span>
            {message}
          </span>

          <button
            type="button"
            onClick={() =>
              setMessage("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* STATS */}
      <section className="recycling-stat-grid">

        <StatCard
          label="Total batches"
          value={stats.total_batches}
          caption="Recycling batches received"
          icon={Package}
          tone="green"
        />

        <StatCard
          label="Incoming material"
          value={`${formatNumber(
            stats.incoming_weight_kg
          )} kg`}
          caption={`${stats.incoming_count} collected pickups waiting`}
          icon={Truck}
          tone="blue"
        />

        <StatCard
          label="Received"
          value={stats.received_batches}
          caption="Awaiting processing"
          icon={Clock3}
          tone="orange"
        />

        <StatCard
          label="Processing"
          value={
            stats.processing_batches
          }
          caption="Currently being processed"
          icon={Factory}
          tone="purple"
        />

        <StatCard
          label="Completed"
          value={
            stats.completed_batches
          }
          caption="Successfully processed"
          icon={CheckCircle2}
          tone="green"
        />

        <StatCard
          label="Rejected"
          value={
            stats.rejected_batches
          }
          caption="Rejected material batches"
          icon={AlertTriangle}
          tone="green"
        />

        <StatCard
          label="Received weight"
          value={`${formatNumber(
            stats.total_received_kg
          )} kg`}
          caption="Total recyclable material received"
          icon={Scale}
          tone="blue"
        />

        <StatCard
          label="Recovery rate"
          value={`${formatNumber(
            stats.recovery_rate
          )}%`}
          caption={`${formatNumber(
            stats.total_processed_kg
          )} kg processed`}
          icon={Recycle}
          tone="green"
        />

      </section>

      {/* WORKSPACE */}
      <section className="recycling-workspace">

        {/* TABS */}
        <div className="recycling-tabs">

          {!isCompany && (
            <button
              type="button"
              className={
                activeTab === "overview"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab(
                  "overview"
                )
              }
            >
              Overview
            </button>
          )}

          <button
            type="button"
            className={
              activeTab === "incoming"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(
                "incoming"
              )
            }
          >
            Incoming Material

            {incoming.length >
              0 && (
              <span>
                {incoming.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={
              activeTab === "batches"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(
                "batches"
              )
            }
          >
            Recycling Batches
          </button>

        </div>

        {/* SEARCH */}
        {(activeTab ===
          "incoming" ||
          activeTab ===
            "batches") && (
          <div className="recycling-toolbar">

            <div className="recycling-search">

              <Search
                size={18}
              />

              <input
                type="search"
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder={
                  activeTab ===
                  "incoming"
                    ? "Search reference, customer or waste type..."
                    : "Search batch, pickup reference or status..."
                }
              />

            </div>

          </div>
        )}

        {/* OVERVIEW */}
        {activeTab ===
          "overview" && (
          <div className="recycling-overview">

            <div className="recycling-overview-card">

              <div className="recycling-overview-card__icon">
                <Scale size={24} />
              </div>

              <div>
                <span>
                  Total recyclable material
                </span>

                <strong>
                  {formatNumber(
                    stats.total_received_kg
                  )}{" "}
                  kg
                </strong>

                <p>
                  Material formally
                  received into recycling
                  operations.
                </p>
              </div>

            </div>

            <div className="recycling-overview-card">

              <div className="recycling-overview-card__icon">
                <Recycle size={24} />
              </div>

              <div>
                <span>
                  Processing performance
                </span>

                <strong>
                  {formatNumber(
                    stats.recovery_rate
                  )}%
                </strong>

                <p>
                  Ratio of processed
                  weight to received
                  weight.
                </p>
              </div>

            </div>

            <div className="recycling-overview-card">

              <div className="recycling-overview-card__icon">
                <Truck size={24} />
              </div>

              <div>
                <span>
                  Awaiting intake
                </span>

                <strong>
                  {formatNumber(
                    stats.incoming_weight_kg
                  )}{" "}
                  kg
                </strong>

                <p>
                  Collected recyclable
                  waste waiting to be
                  received.
                </p>
              </div>

            </div>

          </div>
        )}

        {/* INCOMING */}
        {activeTab ===
          "incoming" && (
          <div className="recycling-table-card">

            <div className="recycling-table-header">

              <div>
                <h2>
                  Incoming recyclable
                  material
                </h2>

                <p>
                  Collected recyclable
                  pickups that have not
                  yet entered a recycling
                  batch.
                </p>
              </div>

              <strong>
                {filteredIncoming.length}{" "}
                pending
              </strong>

            </div>

            {filteredIncoming.length ===
            0 ? (
              <EmptyState
                icon={Truck}
                title="No incoming recyclable material"
                text={
                  isCompany
                    ? "There are currently no collected recyclable pickups available for this recycling company."
                    : "Collected recyclable pickups will appear here when they are ready to enter the recycling operation."
                }
              />
            ) : (
              <div className="recycling-table-wrap">

                <table className="recycling-table">

                  <thead>
                    <tr>
                      <th>
                        Reference
                      </th>

                      <th>
                        Customer
                      </th>

                      <th>
                        Waste type
                      </th>

                      <th>
                        Weight
                      </th>

                      <th>
                        Collected
                      </th>

                      <th>
                        Status
                      </th>

                      {canReceive && (
                        <th>
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>

                    {filteredIncoming.map(
                      (item) => (
                        <tr
                          key={
                            item.pickup_id
                          }
                        >
                          <td>
                            <strong>
                              {
                                item.reference
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              item.customer ||
                              "—"
                            }
                          </td>

                          <td>
                            <span className="recycling-material">
                              <Recycle
                                size={15}
                              />

                              {
                                item.waste_category ||
                                "—"
                              }
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatNumber(
                                item.weight
                              )}{" "}
                              kg
                            </strong>
                          </td>

                          <td>
                            {formatDate(
                              item.completed_at
                            )}
                          </td>

                          <td>
                            <span className="recycling-status recycling-status--collected">
                              Collected
                            </span>
                          </td>

                          {canReceive && (
                            <td>
                              <button
                                type="button"
                                className="recycling-primary-small-btn"
                                onClick={() =>
                                  openReceiveModal(
                                    item
                                  )
                                }
                              >
                                Receive

                                <ArrowRight
                                  size={15}
                                />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>
        )}

        {/* BATCHES */}
        {activeTab ===
          "batches" && (
          <div className="recycling-table-card">

            <div className="recycling-table-header">

              <div>
                <h2>
                  Recycling batches
                </h2>

                <p>
                  Track every material
                  batch from receipt
                  through final
                  processing.
                </p>
              </div>

              <strong>
                {filteredBatches.length}{" "}
                batches
              </strong>

            </div>

            {filteredBatches.length ===
            0 ? (
              <EmptyState
                icon={Package}
                title="No recycling batches yet"
                text="Once recyclable material is received, the batch will appear here."
              />
            ) : (
              <div className="recycling-table-wrap">

                <table className="recycling-table">

                  <thead>
                    <tr>
                      <th>
                        Batch
                      </th>

                      <th>
                        Pickup
                      </th>

                      <th>
                        Material
                      </th>

                      <th>
                        Received
                      </th>

                      <th>
                        Processed
                      </th>

                      <th>
                        Status
                      </th>

                      {canManage && (
                        <th>
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>

                    {filteredBatches.map(
                      (batch) => (
                        <tr
                          key={
                            batch.id
                          }
                        >
                          <td>
                            <strong>
                              #
                              {
                                batch.id
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              batch.pickup_reference ||
                              batch.reference ||
                              "—"
                            }
                          </td>

                          <td>
                            <span className="recycling-material">
                              <Recycle
                                size={15}
                              />

                              {getWasteCategoryName(
                                batch.waste_category
                              )}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatNumber(
                                batch.weight_received
                              )}{" "}
                              kg
                            </strong>
                          </td>

                          <td>
                            {batch.weight_processed !=
                            null
                              ? `${formatNumber(
                                  batch.weight_processed
                                )} kg`
                              : "—"}
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                batch.status
                              )}
                            >
                              {statusLabel(
                                batch.status
                              )}
                            </span>
                          </td>

                          {canManage && (
                            <td>
                              {batch.status !==
                                "processed" &&
                              batch.status !==
                                "rejected" ? (
                                <button
                                  type="button"
                                  className="recycling-secondary-small-btn"
                                  onClick={() =>
                                    openProcessModal(
                                      batch
                                    )
                                  }
                                >
                                  Manage
                                </button>
                              ) : (
                                <span className="recycling-completed-label">
                                  Complete
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>
        )}

      </section>

      {/* ======================================================
          RECEIVE MATERIAL MODAL
          ====================================================== */}

      {/* ======================================================
    RECEIVE MATERIAL MODAL
====================================================== */}

{selectedPickup && (
  <div
    className="recycling-modal-backdrop"
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        closeReceiveModal();
      }
    }}
  >
    <section
      className="recycling-receive-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-material-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {/* HEADER */}
      <div className="recycling-receive-modal-header">
        <div className="recycling-receive-modal-title">
          <span className="recycling-modal-kicker">
            MATERIAL INTAKE
          </span>

          <h2 id="receive-material-title">
            Receive recyclable material
          </h2>

          <p>
            Confirm the material received at the recycling
            facility before adding it to recycling operations.
          </p>
        </div>

        <button
          type="button"
          className="recycling-modal-close"
          onClick={closeReceiveModal}
          disabled={saving}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
      </div>

      {/* PICKUP SUMMARY */}
      <div className="recycling-receive-summary">
        <div className="recycling-receive-summary-card">
          <span>Pickup reference</span>

          <strong>
            {selectedPickup.reference || "—"}
          </strong>
        </div>

        <div className="recycling-receive-summary-card">
          <span>Waste type</span>

          <strong>
            {selectedPickup.waste_category || "—"}
          </strong>
        </div>

        <div className="recycling-receive-summary-card">
          <span>Collected weight</span>

          <strong>
            {formatNumber(selectedPickup.weight)} kg
          </strong>
        </div>
      </div>

      {/* FORM */}
      <div className="recycling-receive-form">

        {/* ACTUAL WEIGHT */}
        <div className="recycling-receive-field">
          <label htmlFor="received-weight">
            Actual received weight
            <span>(kg)</span>
          </label>

          <input
            id="received-weight"
            type="number"
            min="0.01"
            step="0.01"
            value={receiveWeight}
            onChange={(event) => {
              setReceiveWeight(event.target.value);
              setError("");
            }}
            placeholder="Enter actual received weight"
            disabled={saving}
            autoFocus
          />

          <small>
            Enter the actual weight received at the
            recycling facility.
          </small>
        </div>

        {/* NOTES */}
        <div className="recycling-receive-field">
          <label htmlFor="receive-notes">
            Notes
            <span>Optional</span>
          </label>

          <textarea
            id="receive-notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setError("");
            }}
            rows={4}
            placeholder="Add any notes about the material intake..."
            disabled={saving}
          />
        </div>

      </div>

      {/* ERROR */}
      {error && (
        <div
          className="recycling-receive-error"
          role="alert"
        >
          <AlertCircle size={18} />

          <span>{error}</span>
        </div>
      )}

      {/* ACTIONS */}
      <div className="recycling-receive-actions">
        <button
          type="button"
          className="recycling-secondary-btn"
          onClick={closeReceiveModal}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="button"
          className="recycling-primary-btn"
          onClick={receiveMaterial}
          disabled={
            saving ||
            !receiveWeight ||
            Number(receiveWeight) <= 0
          }
        >
          {saving ? (
            <>
              <RefreshCw
                size={17}
                className="spin"
              />
              Receiving...
            </>
          ) : (
            <>
              Receive Material
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </div>
    </section>
  </div>
)}

      {/* ======================================================
          PROCESS BATCH MODAL
          ====================================================== */}

      {selectedBatch && (
        <div
          className="recycling-modal-backdrop"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeProcessModal();
            }
          }}
        >
          <section
            className="recycling-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="process-batch-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="recycling-modal-heading">

              <div>
                <span className="modal-kicker">
                  Batch processing
                </span>

                <h2 id="process-batch-title">
                  Manage recycling batch
                </h2>

                <p>
                  Update the processing
                  status and processed
                  weight.
                </p>
              </div>

              <button
                type="button"
                className="recycling-icon-btn"
                onClick={
                  closeProcessModal
                }
                disabled={saving}
                aria-label="Close"
              >
                <X size={18} />
              </button>

            </div>

            <div className="recycling-modal-summary">

              <div>
                <span>
                  Batch
                </span>

                <strong>
                  #
                  {
                    selectedBatch.id
                  }
                </strong>
              </div>

              <div>
                <span>
                  Pickup
                </span>

                <strong>
                  {
                    selectedBatch.pickup_reference ||
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Received
                </span>

                <strong>
                  {formatNumber(
                    selectedBatch.weight_received
                  )}{" "}
                  kg
                </strong>
              </div>

            </div>

            <div className="recycling-form">

              <label className="recycling-field-group">

                <span>
                  Processing status
                </span>

                <select
                  value={
                    processingStatus
                  }
                  onChange={(
                    event
                  ) =>
                    setProcessingStatus(
                      event.target.value
                    )
                  }
                  disabled={saving}
                >
                  <option value="processing">
                    Processing
                  </option>

                  <option value="processed">
                    Processed
                  </option>

                  <option value="rejected">
                    Rejected
                  </option>

                  <option value="sold">
                    Sold
                  </option>
                </select>

              </label>

              <label className="recycling-field-group">

                <span>
                  Processed weight
                  <small>
                    {" "}
                    (kg)
                  </small>
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    processingWeight
                  }
                  onChange={(
                    event
                  ) =>
                    setProcessingWeight(
                      event.target.value
                    )
                  }
                  disabled={saving}
                />

              </label>

              <label className="recycling-field-group recycling-full">

                <span>
                  Notes
                </span>

                <textarea
                  rows="4"
                  value={notes}
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Add processing notes..."
                  disabled={saving}
                />

              </label>

            </div>

            {error && (
              <div className="recycling-modal-error">
                <AlertCircle
                  size={18}
                />

                <span>
                  {error}
                </span>
              </div>
            )}

            <div className="recycling-modal-actions">

              <button
                type="button"
                className="recycling-secondary-btn"
                onClick={
                  closeProcessModal
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="recycling-primary-btn"
                onClick={
                  updateBatch
                }
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2
                      size={17}
                      className="spin"
                    />

                    Saving...
                  </>
                ) : (
                  <>
                    Save Changes

                    <CheckCircle2
                      size={17}
                    />
                  </>
                )}
              </button>

            </div>

          </section>
        </div>
      )}

    </main>
  );
}