import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Truck,
  X,
  XCircle,
  ArrowUpDown,
  Check,
  Navigation,
  PackageCheck,
  UserPlus,
} from "lucide-react";

import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/requests.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "accepted", label: "Accepted" },
  { value: "en_route", label: "En Route" },
  { value: "collected", label: "Collected" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_FLOW = ["pending", "assigned", "accepted", "en_route", "collected"];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function formatWeight(value) {
  return `${Number(value || 0).toFixed(1)} kg`;
}

function getLocation(pickup) {
  const address = pickup?.address;
  if (!address) return "—";
  if (typeof address === "string") return address;
  return [address.street, address.city, address.state].filter(Boolean).join(", ");
}

function humanize(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.error || error.response?.data?.message || fallback;
}

function getPaymentStatus(pickup) {
  return String(
    pickup?.invoice?.status || "not invoiced"
  ).trim().toLowerCase();
}

function isPickupPaid(pickup) {
  return getPaymentStatus(pickup) === "paid";
}

function getCustomerName(pickup) {
  if (typeof pickup?.customer === "string") return pickup.customer;
  return (
    pickup?.customer?.full_name ||
    pickup?.customer?.name ||
    pickup?.customer_name ||
    pickup?.user?.full_name ||
    "—"
  );
}

function Timeline({ status }) {
  if (status === "cancelled") {
    return (
      <div className="request-timeline cancelled">
        <div className="timeline-cancelled">
          <XCircle size={18} /> Request Cancelled
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(status);

  return (
    <div className="request-timeline">
      {STATUS_FLOW.map((item, index) => {
        const isComplete = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div
            className={`timeline-step ${isComplete ? "complete" : ""} ${
              isCurrent ? "current" : ""
            }`}
            key={item}
          >
            <div className="timeline-dot">
              {isComplete ? <CheckCircle2 size={16} /> : index + 1}
            </div>
            <span>{humanize(item)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Requests() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isCollector = user.role === "collector";
  const isAdmin = user.role === "admin";

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, per_page: 10 });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [collectors, setCollectors] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [assigningPickup, setAssigningPickup] = useState(null);
  const [assignment, setAssignment] = useState({ collector_id: "", vehicle_id: "" });
  const selectedCollector = useMemo(() => {
  return collectors.find(
    (c) => c.id === Number(assignment.collector_id)
  );
}, [collectors, assignment.collector_id]);

  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedPickup(null);
        setAssigningPickup(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadPickups = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const endpoint = isCollector ? "/collector/pickups" : "/pickups";
      const response = await api.get(endpoint, {
        params: isCollector
          ? {}
          : {
              page,
              per_page: pageSize,
              ...(status ? { status } : {}),
            },
      });

      if (isCollector) {
        const pickups = Array.isArray(response.data) ? response.data : response.data?.items || [];
        setItems(pickups);
        setMeta({ page: 1, pages: 1, total: pickups.length, per_page: pickups.length });
      } else {
        const data = response.data || {};
        setItems(data.items || []);
        setMeta(
          data.meta || {
            page: data.current_page || page,
            pages: data.pages || 1,
            total: data.total || 0,
            per_page: data.per_page || pageSize,
          },
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load collection requests."));
    } finally {
      setLoading(false);
    }
  }, [isCollector, page, pageSize, status]);

  useEffect(() => {
    loadPickups();
  }, [loadPickups]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedItems.map((item) => item.id)));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCollectorStatusUpdate = async (pickupId, action, payload = {}) => {
    const endpointMap = {
      accepted: "accept",
      rejected: "reject",
      en_route: "start",
      collected: "complete",
    };

    const endpoint = endpointMap[action];
    if (!endpoint) {
      setError(`Unsupported collector action: ${action}`);
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setMessage("");

      await api.patch(`/collector/pickups/${pickupId}/${endpoint}`, payload);

      setMessage(
        action === "rejected"
          ? "Pickup assignment declined successfully."
          : `Pickup job ${humanize(action)} successfully.`
      );

      setSelectedPickup((prev) => (prev?.id === pickupId ? null : prev));
      await loadPickups();
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${endpoint} this pickup.`));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompletePickup = async (pickup) => {
    const enteredWeight = window.prompt(
      `Enter the actual collected weight for ${pickup.reference} (kg):`,
      pickup.actual_weight ?? pickup.estimated_weight ?? pickup.weight ?? ""
    );

    if (enteredWeight === null) return;

    const actualWeight = Number(enteredWeight);
    if (!Number.isFinite(actualWeight) || actualWeight < 0) {
      setError("Please enter a valid actual weight in kilograms.");
      return;
    }

    await handleCollectorStatusUpdate(pickup.id, "collected", {
      actual_weight: actualWeight,
    });
  };

  const loadAssignmentOptions = useCallback(async () => {
    try {
      setAssignmentLoading(true);
      const [collectorRes, vehicleRes] = await Promise.all([
        api.get("/admin/collectors"),
        api.get("/admin/vehicles"),
      ]);

      const rawCollectors = collectorRes.data?.items || collectorRes.data || [];
      //just added
      console.log(rawCollectors);
      //just added

      // Flexible filter so non-strict status representations don't empty out the list
      const availableCollectors = rawCollectors.filter((p) => {
        const isActive = p?.is_active ?? p?.user?.is_active ?? true;
        const approvalStatus = (p?.approval_status || p?.user?.approval_status || "approved").toLowerCase();
        const availability = (p?.availability_status || p?.status || "available").toLowerCase();

        return (
          isActive &&
          (approvalStatus === "approved" || approvalStatus === "active") &&
          (availability === "available" || availability === "active" || availability === "on_duty")
        );
      });

      const rawVehicles = vehicleRes.data?.items || vehicleRes.data || [];
      const availableVehicles = rawVehicles.filter(
        (v) => !v.status || v.status === "available" || v.status === "active"
      );

      // Fallback to raw list if filtering returns empty due to unexpected field names
      setCollectors(availableCollectors.length > 0 ? availableCollectors : rawCollectors);
      setVehicles(availableVehicles.length > 0 ? availableVehicles : rawVehicles);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load assignment resources."));
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  const processedItems = useMemo(() => {
    let result = [...items];
    const query = debouncedSearch.trim().toLowerCase();

    if (query) {
      result = result.filter((pickup) => {
        const customerName = getCustomerName(pickup);
        const phone = pickup.phone || pickup.customer?.phone || "";
        const waste = pickup.waste_type || pickup.waste_category?.name || "";

        const fields = isCollector
          ? [pickup.reference, customerName, phone, getLocation(pickup), waste, pickup.status]
          : [
              pickup.reference,
              customerName,
              pickup.customer?.email,
              phone,
              getLocation(pickup),
              waste,
              pickup.collector?.full_name,
              pickup.vehicle?.registration_number,
              pickup.status,
            ];

        return fields.filter(Boolean).join(" ").toLowerCase().includes(query);
      });
    }

    if (isCollector && status) {
      result = result.filter((pickup) => pickup.status === status);
    }

    if (!isCollector && assignmentFilter) {
      result = result.filter((pickup) => {
        const isAssigned = Boolean(pickup.collector || pickup.collector_id);
        return assignmentFilter === "assigned" ? isAssigned : !isAssigned;
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? "";
        let bVal = b[sortConfig.key] ?? "";

        if (sortConfig.key === "customer") {
          aVal = getCustomerName(a);
          bVal = getCustomerName(b);
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, debouncedSearch, isCollector, assignmentFilter, sortConfig]);

  const stats = useMemo(() => {
    if (isCollector) {
      return {
        assigned: items.filter((p) => p.status === "assigned").length,
        accepted: items.filter((p) => p.status === "accepted").length,
        en_route: items.filter((p) => p.status === "en_route").length,
        completed: items.filter((p) => p.status === "collected").length,
      };
    }
    return {
      total: items.length,
      pending: items.filter((p) => p.status === "pending").length,
      active: items.filter((p) => ["assigned", "accepted", "en_route"].includes(p.status)).length,
      collected: items.filter((p) => p.status === "collected").length,
      cancelled: items.filter((p) => p.status === "cancelled").length,
    };
  }, [items, isCollector]);

 
 async function submitAssignment(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!assigningPickup) {
    return;
  }

  if (!isPickupPaid(assigningPickup)) {
    setError(
      "Payment is required before this pickup can be assigned to a collector.",
    );
    return;
  }

  const collectorId = Number(assignment.collector_id);

  if (!collectorId) {
    setError("Please select a collector.");
    return;
  }

  const selectedCollectorRecord = collectors.find(
    (collector) => Number(collector.id) === collectorId,
  );

  if (!selectedCollectorRecord) {
    setError("Selected collector could not be found.");
    return;
  }

  const vehicleId = selectedCollectorRecord?.vehicle?.id;

  if (!vehicleId) {
    setError(
      "The selected collector does not have a vehicle assigned.",
    );
    return;
  }

  try {
    setActionLoading(true);
    setError("");
    setMessage("");

    const response = await api.post(
      `/admin/pickups/${assigningPickup.id}/assign`,
      {
        collector_id: collectorId,
        vehicle_id: Number(vehicleId),
      },
    );

    console.log("Assignment response:", response.data);

    setMessage("Pickup successfully assigned.");

    setAssigningPickup(null);

    setAssignment({
      collector_id: "",
      vehicle_id: "",
    });

    await loadPickups();
  } catch (err) {
    console.error("Assignment error:", err);

    setError(
      getErrorMessage(
        err,
        "Unable to assign pickup.",
      ),
    );
  } finally {
    setActionLoading(false);
  }
}

  return (
    <section className="requests-page">
      <div className="requests-heading">
        <div>
          <span className="requests-kicker">
            {isCollector ? "Collector Workbench" : "Operations Dashboard"}
          </span>
          <h1>{isCollector ? "Assigned Pickup Jobs" : "Collection Requests"}</h1>
          <p>
            {isCollector
              ? "View and manage active waste collection routes."
              : "Real-time enterprise overview for request assignments and job tracking."}
          </p>
        </div>

        <div className="header-actions">
          <button type="button" className="secondary-btn" onClick={loadPickups} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </div>

      {message && (
        <div className="request-feedback success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="request-feedback error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Section */}
      <section className="request-summary-grid">
        {isCollector ? (
          <>
            <article className="kpi-card">
              <Clock3 size={20} />
              <div>
                <span>Pending Approval</span>
                <strong>{stats.assigned}</strong>
              </div>
            </article>
            <article className="kpi-card">
              <CheckCircle2 size={20} />
              <div>
                <span>Accepted</span>
                <strong>{stats.accepted}</strong>
              </div>
            </article>
            <article className="kpi-card">
              <Truck size={20} />
              <div>
                <span>En Route</span>
                <strong>{stats.en_route}</strong>
              </div>
            </article>
            <article className="kpi-card">
              <CheckCircle2 size={20} />
              <div>
                <span>Completed</span>
                <strong>{stats.completed}</strong>
              </div>
            </article>
          </>
        ) : (
          <>
            <article className="kpi-card">
              <Filter size={20} />
              <div>
                <span>Loaded Records</span>
                <strong>{stats.total}</strong>
                <small>{meta.total} Total Records</small>
              </div>
            </article>
            <article className="kpi-card">
              <Clock3 size={20} />
              <div>
                <span>Pending</span>
                <strong>{stats.pending}</strong>
                <small>Needs Action</small>
              </div>
            </article>
            <article className="kpi-card">
              <Truck size={20} />
              <div>
                <span>Active Jobs</span>
                <strong>{stats.active}</strong>
                <small>In Progress</small>
              </div>
            </article>
            <article className="kpi-card">
              <CheckCircle2 size={20} />
              <div>
                <span>Collected</span>
                <strong>{stats.collected}</strong>
                <small>{stats.cancelled} Cancelled</small>
              </div>
            </article>
          </>
        )}
      </section>

      {/* Toolbar Controls */}
      <div className="datatable-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <Search size={18} />
            <input
              type="search"
              aria-label="Search requests"
              placeholder="Search reference, customer, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="clear-search-btn" onClick={() => setSearch("")}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-group">
            <select
              aria-label="Filter by Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {!isCollector && (
              <select
                aria-label="Filter by Assignment"
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
              >
                <option value="">All Assignments</option>
                <option value="assigned">Assigned Only</option>
                <option value="unassigned">Unassigned Only</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="datatable-container">
        <table className="enterprise-datatable">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  checked={
                    processedItems.length > 0 && selectedIds.size === processedItems.length
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
              <th onClick={() => handleSort("reference")} className="sortable-th">
                Reference <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort("customer")} className="sortable-th">
                Customer <ArrowUpDown size={12} />
              </th>
              <th>Phone</th>
              <th>Address</th>
              <th>Waste Type</th>
              <th>Weight</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td colSpan={9}>
                    <div className="skeleton-line" />
                  </td>
                </tr>
              ))
            ) : processedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  No matching pickup jobs found.
                </td>
              </tr>
            ) : (
              processedItems.map((pickup) => (
                <tr key={pickup.id} className={selectedIds.has(pickup.id) ? "row-selected" : ""}>
                  <td className="td-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pickup.id)}
                      onChange={() => toggleSelectRow(pickup.id)}
                      aria-label={`Select pickup ${pickup.reference}`}
                    />
                  </td>
                  <td className="font-semibold">{pickup.reference}</td>
                  <td>{getCustomerName(pickup)}</td>
                  <td>{pickup.phone || pickup.customer?.phone || "—"}</td>
                  <td>{getLocation(pickup)}</td>
                  <td>{pickup.waste_type || pickup.waste_category?.name || "General"}</td>
                  <td>
                    {formatWeight(
                      pickup.actual_weight ??
                      pickup.estimated_weight ??
                      pickup.weight
                    )}
                  </td>
                  <td>
                    <StatusBadge status={pickup.status} />
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: isPickupPaid(pickup) ? "#15803d" : "#b45309",
                      }}
                    >
                      Payment: {isPickupPaid(pickup) ? "Paid" : "Required"}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="table-actions">
                      <button
                        type="button"
                        className="icon-action"
                        title="View Details"
                        aria-label="View Details"
                        onClick={() => setSelectedPickup(pickup)}
                      >
                        <Eye size={16} />
                      </button>

                      {/* COLLECTOR ACTIONS */}
                      {isCollector && (
                        <>
                          {pickup.status === "assigned" && (
                            <>
                              <button
                                type="button"
                                className="primary-btn btn-sm btn-success"
                                disabled={actionLoading}
                                title="Accept Job Assignment"
                                onClick={() =>
                                  handleCollectorStatusUpdate(pickup.id, "accepted")
                                }
                              >
                                <Check size={14} /> Accept
                              </button>
                              <button
                                type="button"
                                className="secondary-btn btn-sm btn-danger"
                                disabled={actionLoading}
                                title="Decline Assignment"
                                onClick={() =>
                                  handleCollectorStatusUpdate(pickup.id, "rejected")
                                }
                              >
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}

                          {pickup.status === "accepted" && (
                            <button
                              type="button"
                              className="primary-btn btn-sm"
                              disabled={actionLoading}
                              onClick={() => handleCollectorStatusUpdate(pickup.id, "en_route")}
                            >
                              <Navigation size={14} /> Start Route
                            </button>
                          )}

                          {pickup.status === "en_route" && (
                            <button
                              type="button"
                              className="primary-btn btn-sm btn-complete"
                              disabled={actionLoading}
                              onClick={() => handleCompletePickup(pickup)}
                            >
                              <PackageCheck size={14} /> Complete
                            </button>
                          )}
                        </>
                      )}

                      {/* ADMIN ASSIGN ACTION */}
                      {isAdmin && pickup.status === "pending" && (
                        isPickupPaid(pickup) ? (
                          <button
                            type="button"
                            className="primary-btn btn-sm"
                            onClick={() => {
                              setAssigningPickup(pickup);
                              loadAssignmentOptions();
                            }}
                          >
                            <UserPlus size={14} /> Assign
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn btn-sm"
                            disabled
                            title="Customer payment is required before assignment"
                          >
                            Payment Required
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isCollector && meta.pages > 1 && (
        <div className="datatable-pagination">
          <div className="pagination-info">
            Showing Page <strong>{meta.page}</strong> of <strong>{meta.pages}</strong> (
            {meta.total} Total Items)
          </div>
          <div className="pagination-controls">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Items per page"
            >
              {PAGE_SIZE_OPTIONS.map((sz) => (
                <option key={sz} value={sz}>
                  {sz} per page
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              type="button"
              className="secondary-btn btn-sm"
              disabled={page >= meta.pages}
              onClick={() => setPage((p) => Math.min(p + 1, meta.pages))}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Assignment Modal for Admins */}
      {assigningPickup && (
        <div
          className="modal-backdrop"
          onClick={() => setAssigningPickup(null)}
          role="presentation"
        >
          <section
            className="request-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-heading">
              <div>
                <h2>Assign Pickup #{assigningPickup.reference}</h2>
                <p>Select an available collector and vehicle to process this route.</p>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setAssigningPickup(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitAssignment} className="assignment-form">

  {/* Collector */}
  <div className="form-group">
    <label htmlFor="collector-select">Collector</label>

    <select
      id="collector-select"
      required
      value={assignment.collector_id}
      onChange={(e) =>
  setAssignment({
    collector_id: Number(e.target.value),
    vehicle_id: "",
  })
}
      disabled={assignmentLoading}
    >
      <option value="">
        {assignmentLoading
          ? "Loading collectors..."
          : "Select Collector..."}
      </option>

      {collectors.map((c) => (
      <option key={c.id} value={c.id}>
          {c.user?.full_name}
          {c.collector_code
            ? ` (${c.collector_code})`
            : ""}
        </option>
      ))}
    </select>
  </div>
      

  {/* Vehicle */}
  {/* Vehicle */}
<div className="form-group">
  <label>Assigned Vehicle</label>

  <input
    type="text"
    className="form-control"
    disabled
    value={selectedCollector?.vehicle?.registration_number || ""}
  />
</div>

  <div className="modal-actions">

    <button
      type="button"
      className="secondary-btn"
      onClick={() => setAssigningPickup(null)}
    >
      Cancel
    </button>

    <button
  type="submit"
  className="primary-btn"
  disabled={
    actionLoading ||
    !assignment.collector_id ||
    !selectedCollector?.vehicle?.id
  }
>
  {actionLoading
    ? "Assigning..."
    : "Confirm Assignment"}
</button>

  </div>

</form>
          
            
          </section>
        </div>
      )}

      {/* View Details Modal */}
      {selectedPickup && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedPickup(null)}
          role="presentation"
        >
          <section
            className="request-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-heading">
              <div>
                <h2>Request Reference: {selectedPickup.reference}</h2>
                <p>Status timeline & detailed logistics data.</p>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setSelectedPickup(null)}
              >
                <X size={18} />
              </button>
            </div>

            <Timeline status={selectedPickup.status} />

            <div className="pickup-details-grid">
              <div>
                <small>Customer Name</small>
                <p>{getCustomerName(selectedPickup)}</p>
              </div>
              <div>
                <small>Contact Phone</small>
                <p>{selectedPickup.phone || selectedPickup.customer?.phone || "—"}</p>
              </div>
              <div>
                <small>Collection Point</small>
                <p>{getLocation(selectedPickup)}</p>
              </div>
              <div>
                <small>Schedule Date</small>
                <p>{formatDate(selectedPickup.pickup_date)}</p>
              </div>
            </div>

            <div className="modal-actions">
              {isCollector && selectedPickup.status === "assigned" && (
                <button
                  type="button"
                  className="primary-btn btn-success"
                  disabled={actionLoading}
                  onClick={() => handleCollectorStatusUpdate(selectedPickup.id, "accepted")}
                >
                  Accept Assignment
                </button>
              )}
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedPickup(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}