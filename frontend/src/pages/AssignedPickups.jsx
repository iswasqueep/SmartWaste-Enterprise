import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";

import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/collectors.css";

function getErrorMessage(error) {
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.response?.data?.detail ||
    error.message ||
    "Unable to process collector request."
  );
}

function toSafeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  // Backend detail responses can contain nested objects for
  // address/customer/waste category. Never call string methods
  // directly on those objects.
  if (typeof value === "object") {
    return (
      value.name ||
      value.full_name ||
      value.address ||
      value.address_line ||
      value.street ||
      value.phone ||
      value.email ||
      value.registration_number ||
      ""
    ).toString();
  }

  return String(value);
}

function getEstimatedWeight(pickup) {
  if (!pickup) return null;

  const value =
    pickup.estimated_weight ??
    pickup.weight ??
    null;

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function getActualWeight(pickup) {
  if (!pickup) return null;

  const value = pickup.actual_weight;

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function getDisplayWeight(pickup) {
  if (!pickup) return null;

  return (
    getActualWeight(pickup) ??
    getEstimatedWeight(pickup)
  );
}

function getCustomerName(pickup) {
  return toSafeText(
    pickup?.customer_name ??
    (
      typeof pickup?.customer === "object"
        ? pickup.customer?.full_name
        : pickup?.customer
    )
  );
}

function getCustomerPhone(pickup) {
  return toSafeText(
    pickup?.phone ??
    pickup?.customer_phone ??
    (
      typeof pickup?.customer === "object"
        ? pickup.customer?.phone
        : ""
    )
  );
}

function getPickupAddress(pickup) {
  const address = pickup?.address;

  // The API can return address as an object. Build the complete
  // human-readable address instead of stopping at address_line.
  if (typeof address === "object" && address !== null) {
    const parts = [
      address.address_line,
      address.street,
      address.landmark,
      address.area,
      address.city,
      address.lga,
      address.state,
      address.country,
    ]
      .map((part) => toSafeText(part).trim())
      .filter(Boolean);

    // Remove duplicate consecutive/general values while preserving order.
    return Array.from(
      new Set(parts)
    ).join(", ");
  }

  // Some responses may expose the complete address under
  // pickup_address or as a simple string.
  const fallback = toSafeText(
    address ??
    pickup?.pickup_address
  ).trim();

  return fallback;
}

function getWasteType(pickup) {
  const waste = pickup?.waste_type ?? pickup?.wasteType;

  if (typeof waste === "object" && waste !== null) {
    return toSafeText(
      waste.name ||
      waste.category_name ||
      waste.type
    );
  }

  if (
    (waste === null || waste === undefined || waste === "") &&
    pickup?.waste_category
  ) {
    return toSafeText(
      typeof pickup.waste_category === "object"
        ? pickup.waste_category?.name
        : pickup.waste_category
    );
  }

  return toSafeText(waste);
}

export default function AssignedPickups() {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Tracks action state for button loading.
  // Example: { id: 12, action: "accept" }
  const [actionState, setActionState] = useState(null);

  // Detail Modal State
  const [selectedPickup, setSelectedPickup] = useState(null);

  // Keeps horizontal table scrolling under our control.
  const tableScrollRef = useRef(null);

  // Complete Pickup Modal State
  const [completionPickup, setCompletionPickup] = useState(null);
  const [actualWeight, setActualWeight] = useState("");
  const [collectorNote, setCollectorNote] = useState("");
  const [completionError, setCompletionError] = useState("");

  // Table Controls & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wasteTypeFilter, setWasteTypeFilter] = useState("all");

  // Sorting State
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Helper to trigger temporary success notification
  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setError("");

    setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
  };

  async function loadPickups(showNotification = false) {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/collector/pickups");

      const items = Array.isArray(res.data)
        ? res.data
        : res.data?.items || res.data?.pickups || [];

      setPickups(items);

      if (showNotification) {
        showSuccess("Pickup list refreshed.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPickups();
  }, []);

  // ---------------------------------------------------------
  // Generic Pickup Action
  // Accept / Reject / Start
  // ---------------------------------------------------------
  async function handleAction(pickupId, action) {
    try {
      setActionState({
        id: pickupId,
        action,
      });

      setError("");
      setSuccessMessage("");

      const response = await api.patch(
        `/collector/pickups/${pickupId}/${action}`
      );

      await loadPickups();

      const message =
        response.data?.message ||
        `Pickup ${action}ed successfully!`;

      showSuccess(message);

      if (
        selectedPickup &&
        selectedPickup.id === pickupId
      ) {
        closePickupDetails();
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionState(null);
    }
  }

  // ---------------------------------------------------------
  // Close Pickup Details
  // ---------------------------------------------------------
  function closePickupDetails() {
    setSelectedPickup(null);

    // Return the table to its natural left position after closing
    // the modal. This prevents a modal interaction from leaving
    // the data table visually shifted.
    requestAnimationFrame(() => {
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollLeft = 0;
      }

      if (window.scrollX !== 0) {
        window.scrollTo({
          left: 0,
          top: window.scrollY,
          behavior: "auto",
        });
      }
    });
  }

  // ---------------------------------------------------------
  // Open Pickup Details
  //
  // The collector list endpoint may return a compact "weight"
  // field. The canonical pickup endpoint returns actual_weight.
  // Always fetch the exact record when opening the details modal.
  // ---------------------------------------------------------
  async function openPickupDetails(pickup) {
    // Open immediately using the row that the collector can already see.
    // This guarantees the eye button always opens the modal.
    setSelectedPickup(pickup);
    setError("");

    // Then try to get the authoritative record in the background.
    // The backend may return either:
    //   { ...pickup fields... }
    // or:
    //   { pickup: { ...pickup fields... } }
    try {
      const response = await api.get(
        `/pickups/${pickup.id}`
      );

      const serverPickup =
        response.data?.pickup ||
        (
          response.data &&
          typeof response.data === "object" &&
          !Array.isArray(response.data)
            ? response.data
            : null
        );

      if (
        serverPickup &&
        (serverPickup.id !== undefined ||
          serverPickup.reference)
      ) {
        setSelectedPickup((current) => ({
          ...(current || pickup),
          ...serverPickup,
        }));

        setPickups((currentPickups) =>
          currentPickups.map((item) =>
            item.id === pickup.id
              ? {
                  ...item,
                  ...serverPickup,
                }
              : item
          )
        );
      }
    } catch (requestError) {
      // The modal is already open with the row data.
      // Do not replace a working details view with an error screen.
      console.warn(
        "Unable to refresh pickup details:",
        requestError
      );
    }
  }

  // ---------------------------------------------------------
  // Open Complete Pickup Modal
  // ---------------------------------------------------------
  function openCompletionModal(pickup) {
    setCompletionPickup(pickup);

    setActualWeight(
      getActualWeight(pickup) ??
      getEstimatedWeight(pickup) ??
      ""
    );

    setCollectorNote("");
    setCompletionError("");
    setError("");
  }

  // ---------------------------------------------------------
  // Close Complete Pickup Modal
  // ---------------------------------------------------------
  function closeCompletionModal() {
    if (actionState?.action === "complete") {
      return;
    }

    setCompletionPickup(null);
    setActualWeight("");
    setCollectorNote("");
    setCompletionError("");
  }

  // ---------------------------------------------------------
  // Complete Pickup
  // ---------------------------------------------------------
  async function handleCompletePickup() {
    if (!completionPickup) {
      return;
    }

    const pickupId = completionPickup.id;
    const parsedWeight = Number(actualWeight);

    if (
      actualWeight === "" ||
      actualWeight === null ||
      !Number.isFinite(parsedWeight)
    ) {
      setCompletionError(
        "Please enter the actual weight collected."
      );
      return;
    }

    if (parsedWeight <= 0) {
      setCompletionError(
        "Actual weight must be greater than 0 kg."
      );
      return;
    }

    try {
      setActionState({
        id: pickupId,
        action: "complete",
      });

      setCompletionError("");
      setError("");
      setSuccessMessage("");

      const trimmedNote = collectorNote.trim();

      const payload = {
        status: "collected",
        actual_weight: parsedWeight,
      };

      if (trimmedNote) {
        payload.collector_note = trimmedNote;
      }

      // IMPORTANT:
      // Completion uses the canonical pickup status endpoint.
      // The backend saves actual_weight when status becomes collected.
      const response = await api.patch(
        `/collector/pickups/${pickupId}/complete`,
        payload
      );

      // The status endpoint returns the updated pickup.
      // Use it immediately so the UI does not depend on a stale
      // collector-list response.
      let updatedPickup =
        response.data?.pickup ||
        (
          response.data &&
          typeof response.data === "object" &&
          !Array.isArray(response.data) &&
          (
            response.data.id !== undefined ||
            response.data.reference
          )
            ? response.data
            : null
        );

      // Fetch the canonical pickup record as a second confirmation.
      // This endpoint returns PickupRequest.to_dict(), including
      // actual_weight.
      try {
        const detailResponse = await api.get(
          `/pickups/${pickupId}`
        );

        const detailPickup =
          detailResponse.data?.pickup ||
          (
            detailResponse.data &&
            typeof detailResponse.data === "object" &&
            !Array.isArray(detailResponse.data) &&
            (
              detailResponse.data.id !== undefined ||
              detailResponse.data.reference
            )
              ? detailResponse.data
              : null
          );

        if (detailPickup) {
          updatedPickup = detailPickup;
        }
      } catch (detailError) {
        // The completion itself already succeeded. Do not turn a
        // successful collection into a failure just because the
        // follow-up read failed.
        console.warn(
          "Pickup completed, but the updated pickup could not be reloaded:",
          detailError
        );
      }

      // Guarantee the just-submitted actual weight is reflected in
      // the local record even if the follow-up list endpoint uses
      // a different response shape.
      updatedPickup = {
        ...(completionPickup || {}),
        ...(updatedPickup || {}),
        actual_weight:
          updatedPickup?.actual_weight ??
          parsedWeight,
        status: "collected",
      };

      setPickups((currentPickups) =>
        currentPickups.map((pickup) =>
          pickup.id === pickupId
            ? updatedPickup
            : pickup
        )
      );

      // Also update an already-open detail modal, if applicable.
      if (
        selectedPickup &&
        selectedPickup.id === pickupId
      ) {
        setSelectedPickup(updatedPickup);
      }

      // Refresh the list in the background. The local merge above
      // happens first, so the actual weight is visible immediately.
      await loadPickups();

      // loadPickups may receive a collector-list representation
      // without actual_weight. Re-apply the canonical updated record
      // after the refresh so it cannot overwrite our saved value.
      if (updatedPickup) {
        setPickups((currentPickups) =>
          currentPickups.map((pickup) =>
            pickup.id === pickupId
              ? {
                  ...pickup,
                  ...updatedPickup,
                  actual_weight:
                    updatedPickup.actual_weight ??
                    parsedWeight,
                  status: "collected",
                }
              : pickup
          )
        );
      }

      showSuccess(
        response.data?.message ||
        "Pickup marked as collected successfully."
      );

      setCompletionPickup(null);
      setActualWeight("");
      setCollectorNote("");
      setCompletionError("");
    } catch (requestError) {
      setCompletionError(
        getErrorMessage(requestError)
      );
    } finally {
      setActionState(null);
    }
  }

  // ---------------------------------------------------------
  
  // Header Sorting
  // ---------------------------------------------------------
  const requestSort = (key) => {
    let direction = "asc";

    if (
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }

    setSortConfig({
      key,
      direction,
    });
  };

  // ---------------------------------------------------------
  // KPI Summary Stats
  // ---------------------------------------------------------
  const stats = useMemo(() => {
    const assigned = pickups.filter(
      (p) =>
        p.status === "assigned" ||
        p.status === "pending"
    ).length;

    const accepted = pickups.filter(
      (p) => p.status === "accepted"
    ).length;

    const enRoute = pickups.filter(
      (p) => p.status === "en_route"
    ).length;

    const completed = pickups.filter(
      (p) =>
        p.status === "completed" ||
        p.status === "collected"
    ).length;

    return {
      assigned,
      accepted,
      enRoute,
      completed,
      total: pickups.length,
    };
  }, [pickups]);

  // ---------------------------------------------------------
  // Unique Waste Types
  // ---------------------------------------------------------
  const uniqueWasteTypes = useMemo(() => {
    const types = pickups
      .map(
        (p) =>
          p.waste_type ||
          p.wasteType
      )
      .filter(Boolean);

    return Array.from(new Set(types));
  }, [pickups]);

  // ---------------------------------------------------------
  // Filter + Sort
  // ---------------------------------------------------------
  const processedPickups = useMemo(() => {
    let filtered = pickups.filter((item) => {
      const ref = (
        item.reference ||
        item.id ||
        ""
      )
        .toString()
        .toLowerCase();

      const customer = getCustomerName(item).toLowerCase();

      const address = getPickupAddress(item).toLowerCase();

      const phone = getCustomerPhone(item).toLowerCase();

      const search =
        searchTerm.toLowerCase();

      const matchesSearch =
        ref.includes(search) ||
        customer.includes(search) ||
        address.includes(search) ||
        phone.includes(search);

      const itemStatus =
        toSafeText(item.status).toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        itemStatus ===
          statusFilter.toLowerCase();

      const itemWaste = getWasteType(item).toLowerCase();

      const matchesWaste =
        wasteTypeFilter === "all" ||
        itemWaste ===
          wasteTypeFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesWaste
      );
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal =
          a[sortConfig.key] ?? "";
        let bVal =
          b[sortConfig.key] ?? "";

        if (
          sortConfig.key === "weight" ||
          sortConfig.key ===
            "estimated_weight" ||
          sortConfig.key ===
            "actual_weight"
        ) {
          aVal =
            parseFloat(aVal) || 0;
          bVal =
            parseFloat(bVal) || 0;
        } else {
          aVal = aVal
            .toString()
            .toLowerCase();

          bVal = bVal
            .toString()
            .toLowerCase();
        }

        if (aVal < bVal) {
          return sortConfig.direction ===
            "asc"
            ? -1
            : 1;
        }

        if (aVal > bVal) {
          return sortConfig.direction ===
            "asc"
            ? 1
            : -1;
        }

        return 0;
      });
    }

    return filtered;
  }, [
    pickups,
    searchTerm,
    statusFilter,
    wasteTypeFilter,
    sortConfig,
  ]);

  // ---------------------------------------------------------
  // Reset Pagination
  // ---------------------------------------------------------
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    wasteTypeFilter,
    pageSize,
  ]);

  // ---------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------
  const totalPages =
    Math.ceil(
      processedPickups.length /
        pageSize
    ) || 1;

  const paginatedPickups = useMemo(() => {
    const start =
      (currentPage - 1) *
      pageSize;

    return processedPickups.slice(
      start,
      start + pageSize
    );
  }, [
    processedPickups,
    currentPage,
    pageSize,
  ]);

  // ---------------------------------------------------------
  // Sort Indicator
  // ---------------------------------------------------------
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return (
        <ArrowUpDown
          size={13}
          style={{ opacity: 0.4 }}
        />
      );
    }

    return sortConfig.direction ===
      "asc" ? (
      <ArrowUp
        size={14}
        color="#00a651"
      />
    ) : (
      <ArrowDown
        size={14}
        color="#00a651"
      />
    );
  };

  return (
    <section className="collectors-page">

      {/* =====================================================
          PAGE HEADER
          ===================================================== */}
      <header className="collectors-heading">
        <div>
          <span className="collectors-kicker">
            Operations
          </span>

          <h1>Assigned Pickup Jobs</h1>

          <p>
            View, accept, and update active
            waste collection routes.
          </p>
        </div>

        <button
          type="button"
          className="collector-secondary-btn"
          onClick={() =>
            loadPickups(true)
          }
          disabled={
            loading ||
            !!actionState
          }
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "spin"
                : ""
            }
          />

          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </header>

      {/* =====================================================
          SUCCESS MESSAGE
          ===================================================== */}
      {successMessage && (
        <div className="request-feedback success">
          <CheckCircle2 size={18} />
          <span>
            {successMessage}
          </span>
        </div>
      )}

      {/* =====================================================
          ERROR MESSAGE
          ===================================================== */}
      {error && (
        <div className="request-feedback error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================
          KPI CARDS
          ===================================================== */}
      <section className="collector-summary-grid">

        <article className="kpi-card">
          <Clock size={20} />

          <div>
            <span>Assigned</span>
            <strong>
              {stats.assigned}
            </strong>
          </div>
        </article>

        <article className="kpi-card">
          <Truck size={20} />

          <div>
            <span>Accepted</span>
            <strong>
              {stats.accepted}
            </strong>
          </div>
        </article>

        <article className="kpi-card">
          <MapPin size={20} />

          <div>
            <span>En Route</span>
            <strong>
              {stats.enRoute}
            </strong>
          </div>
        </article>

        <article className="kpi-card">
          <CheckCircle2 size={20} />

          <div>
            <span>Completed</span>
            <strong>
              {stats.completed}
            </strong>
          </div>
        </article>

      </section>

      {/* =====================================================
          DATA TABLE
          ===================================================== */}
      <section
        className="datatable-container"
        style={{ padding: "20px" }}
      >

        <div
          style={{
            marginBottom: "16px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.25rem",
              color: "#142744",
            }}
          >
            Pickups Data Table
          </h2>

          <p
            style={{
              margin:
                "4px 0 0",
              color: "#78869a",
              fontSize:
                "0.88rem",
            }}
          >
            Showing{" "}
            {processedPickups.length}{" "}
            of{" "}
            {stats.total}{" "}
            total jobs
          </p>
        </div>

        {/* ===================================================
            TOOLBAR
            =================================================== */}
        <div
          className="datatable-toolbar"
          style={{
            marginBottom:
              "16px",
            display: "flex",
            justifyContent:
              "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >

          <div
            className="toolbar-left"
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              flex: 1,
            }}
          >

            <div className="search-box">
              <Search
                size={18}
                color="#73849b"
              />

              <input
                type="text"
                placeholder="Search reference, customer or address..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
              />
            </div>

            <div
              className="filter-group"
              style={{
                display: "flex",
                gap: "8px",
              }}
            >

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
              >
                <option value="all">
                  All Statuses
                </option>

                <option value="assigned">
                  Assigned
                </option>

                <option value="accepted">
                  Accepted
                </option>

                <option value="en_route">
                  En Route
                </option>

                <option value="collected">
                  Collected
                </option>

                <option value="completed">
                  Completed
                </option>
              </select>

              <select
                value={
                  wasteTypeFilter
                }
                onChange={(e) =>
                  setWasteTypeFilter(
                    e.target.value
                  )
                }
              >
                <option value="all">
                  All Waste Types
                </option>

                {uniqueWasteTypes.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>

            </div>
          </div>

          {/* ITEMS PER PAGE */}
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize:
                  "0.85rem",
                color:
                  "#64748b",
              }}
            >
              Per page:
            </span>

            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(
                  Number(
                    e.target.value
                  )
                )
              }
              style={{
                width: "70px",
              }}
            >
              <option value={5}>
                5
              </option>

              <option value={10}>
                10
              </option>

              <option value={25}>
                25
              </option>

              <option value={50}>
                50
              </option>
            </select>
          </div>

        </div>

        {/* ===================================================
            TABLE
            =================================================== */}
        <div
          ref={tableScrollRef}
          className="collector-table-scroll"
          style={{
            width: "100%",
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "visible",
            WebkitOverflowScrolling: "touch",
            position: "relative",
            overscrollBehaviorX: "contain",
          }}
        >
          <table
            className="enterprise-datatable"
            style={{
              minWidth: "1240px",
              width: "100%",
              tableLayout: "auto",
            }}
          >

            <thead>
              <tr>

                <th
                  onClick={() =>
                    requestSort(
                      "reference"
                    )
                  }
                  style={{
                    cursor: "pointer",
                    position: "sticky",
                    left: 0,
                    zIndex: 4,
                    background: "#f8fafc",
                    minWidth: "145px",
                    boxShadow: "6px 0 10px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "6px",
                    }}
                  >
                    Reference{" "}
                    {getSortIcon(
                      "reference"
                    )}
                  </div>
                </th>

                <th
                  onClick={() =>
                    requestSort(
                      "customer_name"
                    )
                  }
                  style={{
                    cursor: "pointer",
                    minWidth: "180px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "6px",
                    }}
                  >
                    Customer{" "}
                    {getSortIcon(
                      "customer_name"
                    )}
                  </div>
                </th>

                <th style={{ minWidth: "135px" }}>
                  Phone
                </th>

                <th
                  onClick={() =>
                    requestSort(
                      "address"
                    )
                  }
                  style={{
                    cursor: "pointer",
                    minWidth: "260px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "6px",
                    }}
                  >
                    Address{" "}
                    {getSortIcon(
                      "address"
                    )}
                  </div>
                </th>

                <th
                  onClick={() =>
                    requestSort(
                      "waste_type"
                    )
                  }
                  style={{
                    cursor: "pointer",
                    minWidth: "150px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "6px",
                    }}
                  >
                    Waste Type{" "}
                    {getSortIcon(
                      "waste_type"
                    )}
                  </div>
                </th>

                <th
                  onClick={() =>
                    requestSort(
                      "weight"
                    )
                  }
                  style={{
                    cursor: "pointer",
                    minWidth: "120px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "6px",
                    }}
                  >
                    Weight (kg){" "}
                    {getSortIcon(
                      "weight"
                    )}
                  </div>
                </th>

                <th
                  onClick={() =>
                    requestSort(
                      "status"
                    )
                  }
                  style={{
                    cursor: "pointer",
                    minWidth: "120px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "6px",
                    }}
                  >
                    Status{" "}
                    {getSortIcon(
                      "status"
                    )}
                  </div>
                </th>

                <th
                  style={{
                    textAlign: "right",
                    position: "sticky",
                    right: 0,
                    zIndex: 4,
                    background: "#f8fafc",
                    minWidth: "250px",
                    boxShadow: "-6px 0 10px rgba(15, 23, 42, 0.05)",
                  }}
                >
                  Actions
                </th>

              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="empty-state"
                  >
                    Loading pickup
                    table records...
                  </td>
                </tr>
              ) : paginatedPickups.length ? (
                paginatedPickups.map(
                  (item) => {
                    const itemId =
                      item.id ||
                      item.reference;

                    const isBusy =
                      actionState?.id ===
                      itemId;

                    const currentAction =
                      isBusy
                        ? actionState.action
                        : null;

                    const status =
                      (
                        item.status ||
                        ""
                      ).toLowerCase();

                    const displayWeight =
                      getDisplayWeight(
                        item
                      );

                    return (
                      <tr
                        key={itemId}
                      >

                        <td
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 2,
                            background: "#ffffff",
                            minWidth: "145px",
                            boxShadow: "6px 0 10px rgba(15, 23, 42, 0.04)",
                          }}
                        >
                          <strong>
                            {item.reference ||
                              `#${item.id}`}
                          </strong>
                        </td>

                        <td>
                          {getCustomerName(item) || "—"}
                        </td>

                        <td>
                          {getCustomerPhone(item) || "—"}
                        </td>

                        <td>
                          <span
                            title={getPickupAddress(item)}
                          >
                            {getPickupAddress(item) || "—"}
                          </span>
                        </td>

                        <td>
                          {getWasteType(item) || "—"}
                        </td>

                        <td>
                          {displayWeight !== null ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                              }}
                            >
                              <strong>
                                {displayWeight}
                              </strong>

                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  color:
                                    getActualWeight(item) !== null
                                      ? "#15803d"
                                      : "#64748b",
                                }}
                              >
                                {getActualWeight(item) !== null
                                  ? "Actual"
                                  : "Estimated"}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              item.status
                            }
                          />
                        </td>

                        <td
                          style={{
                            textAlign: "right",
                            position: "sticky",
                            right: 0,
                            zIndex: 3,
                            background: "#ffffff",
                            minWidth: "250px",
                            boxShadow: "-6px 0 10px rgba(15, 23, 42, 0.05)",
                          }}
                        >
                          <div className="table-actions">

                            {/* VIEW */}
                            <button
                              type="button"
                              className="icon-action"
                              title="View Details"
                              onClick={() =>
                                openPickupDetails(item)
                              }
                            >
                              <Eye
                                size={16}
                              />
                            </button>

                            {/* ACCEPT / REJECT */}
                            {(status ===
                              "assigned" ||
                              status ===
                                "pending") && (
                              <>
                                <button
                                  type="button"
                                  className="primary-btn btn-success btn-sm"
                                  disabled={
                                    isBusy
                                  }
                                  onClick={() =>
                                    handleAction(
                                      itemId,
                                      "accept"
                                    )
                                  }
                                >
                                  {currentAction ===
                                  "accept" ? (
                                    <Loader2
                                      size={
                                        14
                                      }
                                      className="spin"
                                    />
                                  ) : (
                                    <Check
                                      size={
                                        14
                                      }
                                    />
                                  )}

                                  Accept
                                </button>

                                <button
                                  type="button"
                                  className="secondary-btn btn-danger btn-sm"
                                  disabled={
                                    isBusy
                                  }
                                  onClick={() =>
                                    handleAction(
                                      itemId,
                                      "reject"
                                    )
                                  }
                                >
                                  {currentAction ===
                                  "reject" ? (
                                    <Loader2
                                      size={
                                        14
                                      }
                                      className="spin"
                                    />
                                  ) : (
                                    <X
                                      size={
                                        14
                                      }
                                    />
                                  )}

                                  Reject
                                </button>
                              </>
                            )}

                            {/* START ROUTE */}
                            {status ===
                              "accepted" && (
                              <button
                                type="button"
                                className="primary-btn btn-complete btn-sm"
                                disabled={
                                  isBusy
                                }
                                onClick={() =>
                                  handleAction(
                                    itemId,
                                    "start"
                                  )
                                }
                              >
                                {currentAction ===
                                "start" ? (
                                  <Loader2
                                    size={
                                      14
                                    }
                                    className="spin"
                                  />
                                ) : (
                                  <Truck
                                    size={
                                      14
                                    }
                                  />
                                )}

                                Start Route
                              </button>
                            )}

                            {/* MARK COLLECTED */}
                            {status ===
                              "en_route" && (
                              <button
                                type="button"
                                className="primary-btn btn-success btn-sm"
                                disabled={
                                  isBusy
                                }
                                onClick={() =>
                                  openCompletionModal(
                                    item
                                  )
                                }
                              >
                                <CheckCircle2
                                  size={
                                    14
                                  }
                                />

                                Mark Collected
                              </button>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  }
                )
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="empty-state"
                  >
                    No pickup records
                    match your current
                    filter criteria.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        {/* ===================================================
            PAGINATION
            =================================================== */}
        {!loading &&
          processedPickups.length >
            0 && (
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginTop:
                  "16px",
                paddingTop:
                  "12px",
                borderTop:
                  "1px solid #eef2f6",
              }}
            >

              <span
                style={{
                  fontSize:
                    "0.85rem",
                  color:
                    "#64748b",
                }}
              >
                Showing{" "}
                {Math.min(
                  (currentPage -
                    1) *
                    pageSize +
                    1,
                  processedPickups.length
                )}{" "}
                to{" "}
                {Math.min(
                  currentPage *
                    pageSize,
                  processedPickups.length
                )}{" "}
                of{" "}
                {
                  processedPickups.length
                }{" "}
                entries
              </span>

              <div
                style={{
                  display:
                    "flex",
                  gap: "6px",
                  alignItems:
                    "center",
                }}
              >

                <button
                  type="button"
                  className="collector-secondary-btn"
                  disabled={
                    currentPage ===
                    1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (p) =>
                        Math.max(
                          p - 1,
                          1
                        )
                    )
                  }
                  style={{
                    padding:
                      "4px 8px",
                  }}
                >
                  <ChevronLeft
                    size={16}
                  />
                </button>

                <span
                  style={{
                    fontSize:
                      "0.88rem",
                    fontWeight: 600,
                    padding:
                      "0 8px",
                  }}
                >
                  Page{" "}
                  {currentPage}{" "}
                  of{" "}
                  {totalPages}
                </span>

                <button
                  type="button"
                  className="collector-secondary-btn"
                  disabled={
                    currentPage >=
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (p) =>
                        Math.min(
                          p + 1,
                          totalPages
                        )
                    )
                  }
                  style={{
                    padding:
                      "4px 8px",
                  }}
                >
                  <ChevronRight
                    size={16}
                  />
                </button>

              </div>
            </div>
          )}

      </section>

      {/* =====================================================
          PICKUP DETAIL MODAL
          ===================================================== */}
      {selectedPickup && (
        <div
          className="modal-backdrop"
          onClick={closePickupDetails}
        >
          <div
            className="request-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-heading">
              <div>
                <h2>
                  Pickup #
                  {selectedPickup.reference ||
                    selectedPickup.id}
                </h2>

                <p>
                  Detailed job information
                  and collection instructions.
                </p>
              </div>

              <button
                type="button"
                className="icon-action"
                onClick={closePickupDetails}
              >
                <X size={18} />
              </button>
            </div>

            <div className="pickup-details-grid">

              <div>
                <small>
                  Customer Name
                </small>

                <p>
                  {getCustomerName(selectedPickup) || "—"}
                </p>
              </div>

              <div>
                <small>
                  Contact Phone
                </small>

                <p>
                  {getCustomerPhone(selectedPickup) || "—"}
                </p>
              </div>

              <div>
                <small>
                  Pickup Address
                </small>

                <p>
                  {getPickupAddress(selectedPickup) || "—"}
                </p>
              </div>

              <div>
                <small>
                  Waste Category
                </small>

                <p>
                  {getWasteType(selectedPickup) || "—"}
                </p>
              </div>

              <div>
                <small>
                  Estimated Weight
                </small>

                <p>
                  {getEstimatedWeight(
                    selectedPickup
                  ) !== null
                    ? `${getEstimatedWeight(
                        selectedPickup
                      )} kg`
                    : "—"}
                </p>
              </div>

              <div>
                <small>
                  Actual Weight
                </small>

                <p>
                  {getActualWeight(
                    selectedPickup
                  ) !== null
                    ? `${getActualWeight(
                        selectedPickup
                      )} kg`
                    : "Not collected yet"}
                </p>
              </div>

              <div>
                <small>
                  Current Status
                </small>

                <p>
                  <StatusBadge
                    status={
                      selectedPickup.status
                    }
                  />
                </p>
              </div>

              {selectedPickup.collector_note && (
                <div>
                  <small>
                    Collector Note
                  </small>

                  <p>
                    {
                      selectedPickup.collector_note
                    }
                  </p>
                </div>
              )}

            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={closePickupDetails}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================
          COMPLETE PICKUP MODAL
          ===================================================== */}
      {completionPickup && (
        <div
          className="modal-backdrop"
          onClick={closeCompletionModal}
        >
          <div
            className="request-modal completion-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-heading">
              <div>
                <h2>
                  Complete Pickup
                </h2>

                <p>
                  Enter the actual waste
                  collected before completing
                  this job.
                </p>
              </div>

              <button
                type="button"
                className="icon-action"
                onClick={
                  closeCompletionModal
                }
                disabled={
                  actionState?.action ===
                  "complete"
                }
              >
                <X size={18} />
              </button>
            </div>

            {/* PICKUP SUMMARY */}
            <div className="completion-summary">

              <div className="completion-summary-card">
                <small>
                  Pickup Reference
                </small>

                <strong>
                  {completionPickup.reference ||
                    `#${completionPickup.id}`}
                </strong>
              </div>

              <div className="completion-summary-card">
                <small>
                  Waste Category
                </small>

                <strong>
                  {getWasteType(completionPickup) || "—"}
                </strong>
              </div>

              <div className="completion-summary-card">
                <small>
                  Customer
                </small>

                <strong>
                  {getCustomerName(completionPickup) || "—"}
                </strong>
              </div>

              <div className="completion-summary-card">
                <small>
                  Estimated Weight
                </small>

                <strong>
                  {getEstimatedWeight(
                    completionPickup
                  ) !== null
                    ? `${getEstimatedWeight(
                        completionPickup
                      )} kg`
                    : "—"}
                </strong>
              </div>

            </div>

            <div className="completion-form">

              {/* ACTUAL WEIGHT */}
              <div className="completion-field">

                <label htmlFor="actual-weight">
                  Actual Weight Collected{" "}
                  <span>*</span>
                </label>

                <input
                  id="actual-weight"
                  type="number"
                  min="0.01"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Enter actual weight in kg"
                  value={actualWeight}
                  onChange={(e) => {
                    setActualWeight(
                      e.target.value
                    );
                    setCompletionError(
                      ""
                    );
                  }}
                  disabled={
                    actionState?.action ===
                    "complete"
                  }
                />

                <p className="completion-help">
                  Enter the weight actually
                  collected from the customer.
                  This value will be used for
                  invoicing, recycling and
                  reporting where applicable.
                </p>

              </div>

              {/* COLLECTOR NOTE */}
              <div className="completion-field">

                <label htmlFor="collector-note">
                  Collector Note
                </label>

                <textarea
                  id="collector-note"
                  placeholder="Optional collection note..."
                  value={collectorNote}
                  onChange={(e) =>
                    setCollectorNote(
                      e.target.value
                    )
                  }
                  disabled={
                    actionState?.action ===
                    "complete"
                  }
                />

              </div>

              {/* VALIDATION ERROR */}
              {completionError && (
                <div className="completion-error">
                  <AlertCircle
                    size={17}
                  />

                  <span>
                    {completionError}
                  </span>
                </div>
              )}

              {/* ACTIONS */}
              <div className="completion-modal-actions">

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    closeCompletionModal
                  }
                  disabled={
                    actionState?.action ===
                    "complete"
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-btn btn-success"
                  onClick={
                    handleCompletePickup
                  }
                  disabled={
                    actionState?.action ===
                    "complete"
                  }
                >
                  {actionState?.action ===
                  "complete" ? (
                    <>
                      <Loader2
                        size={16}
                        className="spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={16}
                      />
                      Complete Collection
                    </>
                  )}
                </button>

              </div>

            </div>

          </div>
        </div>
      )}

    </section>
  );
}
