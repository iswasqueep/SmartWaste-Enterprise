import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Eye,
  Plus,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";

import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/vehicles.css";

const emptyForm = {
  registration_number: "",
  vehicle_type: "",
  capacity_kg: "",
  status: "available",
  last_service_date: "",
};

const vehicleTypes = [
  "Waste Compactor Truck",
  "Rear Loader Truck",
  "Front Loader Truck",
  "Side Loader Truck",
  "Roll-Off Truck",
  "Recycling Collection Truck",
  "Hook Lift Truck",
  "Mini Waste Collection Van",
];

function normalizeVehicle(vehicle = {}) {
  return {
    ...vehicle,
    id: vehicle.id ?? vehicle.vehicle_id,
    registration_number:
      vehicle.registration_number ??
      vehicle.registration_no ??
      vehicle.plate_number ??
      "",
    vehicle_type:
      vehicle.vehicle_type ??
      vehicle.type ??
      vehicle.category ??
      "",
    capacity_kg:
      vehicle.capacity_kg ??
      vehicle.capacity ??
      vehicle.load_capacity ??
      "",
    status: String(vehicle.status ?? "available").toLowerCase(),
    assigned_collector:
      vehicle.assigned_collector ??
      vehicle.collector_name ??
      vehicle.driver_name ??
      null,
    last_service_date:
      vehicle.last_service_date ??
      vehicle.service_date ??
      null,
  };
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

function getCollectorName(value) {
  if (!value) return "Unassigned";
  if (typeof value === "string") return value;

  return (
    value.full_name ||
    value.name ||
    value.email ||
    "Assigned"
  );
}

function getApiError(error, fallbackMessage) {
  if (!error?.response) {
    if (error?.code === "ECONNABORTED") {
      return "The request timed out. Confirm that the backend server is running.";
    }
    return "Unable to connect to the backend server.";
  }

  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.response?.data?.detail ||
    `${fallbackMessage} HTTP status: ${error.response.status}.`
  );
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/vehicles");

      const data =
        response.data?.items ??
        response.data?.vehicles ??
        response.data ??
        [];

      setVehicles(
        Array.isArray(data)
          ? data.map(normalizeVehicle)
          : [],
      );
    } catch (requestError) {
      console.error("Unable to load vehicles:", requestError);
      setError(
        getApiError(
          requestError,
          "Unable to load fleet vehicles.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  // Handle ESC key to close open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showAddModal && !saving) closeAddModal();
        if (selectedVehicle) setSelectedVehicle(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal, saving, selectedVehicle]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]:
        name === "registration_number"
          ? value.toUpperCase()
          : value,
    }));
  }

  function openAddModal() {
    setForm(emptyForm);
    setError("");
    setMessage("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (saving) return;
    setShowAddModal(false);
    setForm(emptyForm);
    setError("");
  }

  async function addVehicle(event) {
    event.preventDefault();

    const registrationNumber = form.registration_number.trim();
    const vehicleType = form.vehicle_type.trim();
    const capacity = Number(form.capacity_kg);

    if (!registrationNumber) {
      setError("Enter the vehicle registration number.");
      return;
    }

    if (!vehicleType) {
      setError("Select a vehicle type.");
      return;
    }

    if (!Number.isFinite(capacity) || capacity <= 0) {
      setError("Enter a valid vehicle capacity greater than zero.");
      return;
    }

    const payload = {
      registration_number: registrationNumber,
      vehicle_type: vehicleType,
      capacity_kg: capacity,
      status: form.status,
      last_service_date: form.last_service_date || null,
    };

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await api.post("/admin/vehicles", payload);

      setShowAddModal(false);
      setForm(emptyForm);
      setMessage("Vehicle added successfully.");

      await loadVehicles();
    } catch (requestError) {
      console.error("Unable to create vehicle:", requestError);
      setError(
        getApiError(
          requestError,
          "The vehicle could not be added.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesSearch =
        !query ||
        [
          vehicle.registration_number,
          vehicle.vehicle_type,
          getCollectorName(vehicle.assigned_collector),
        ].some((value) =>
          String(value).toLowerCase().includes(query),
        );

      const matchesStatus =
        !statusFilter || vehicle.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, search, statusFilter]);

  const summary = useMemo(() => {
    return vehicles.reduce(
      (result, vehicle) => {
        result.total += 1;
        const vehicleStatus = vehicle.status || "inactive";
        result[vehicleStatus] = (result[vehicleStatus] || 0) + 1;
        return result;
      },
      {
        total: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
        inactive: 0,
      },
    );
  }, [vehicles]);

  return (
    <section className="vehicles-page">
      <header className="vehicles-heading">
        <div>
          <span>
            <Truck size={17} />
            Fleet Operations
          </span>
          <h1>Vehicle Management</h1>
          <p>
            Register vehicles, monitor availability, and support pickup assignments.
          </p>
        </div>

        <div className="heading-actions">
          <button
            type="button"
            className="secondary"
            onClick={loadVehicles}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="primary"
            onClick={openAddModal}
          >
            <Plus size={18} />
            Add Vehicle
          </button>
        </div>
      </header>

      {message && (
        <div className="vehicle-alert success" role="alert">
          {message}
        </div>
      )}

      {error && (
        <div className="vehicle-alert error" role="alert">
          {error}
        </div>
      )}

      <div className="vehicle-cards">
        {[
          ["total", "Total Vehicles"],
          ["available", "Available"],
          ["assigned", "Assigned"],
          ["maintenance", "Maintenance"],
          ["inactive", "Inactive"],
        ].map(([key, label]) => (
          <article key={key}>
            <Truck size={21} />
            <div>
              <span>{label}</span>
              <strong>{summary[key] || 0}</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="vehicles-panel">
        <div className="vehicle-toolbar">
          <label>
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search registration, type or collector"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Collector</th>
                <th>Status</th>
                <th>Last Service</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty">
                    Loading vehicles...
                  </td>
                </tr>
              ) : filteredVehicles.length ? (
                filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id || vehicle.registration_number}>
                    <td>
                      <strong>{vehicle.registration_number || "—"}</strong>
                    </td>
                    <td>{vehicle.vehicle_type || "—"}</td>
                    <td>
                      {vehicle.capacity_kg
                        ? `${Number(vehicle.capacity_kg).toLocaleString()} kg`
                        : "—"}
                    </td>
                    <td>
                      {getCollectorName(vehicle.assigned_collector)}
                    </td>
                    <td>
                      <StatusBadge status={vehicle.status} />
                    </td>
                    <td>{formatDate(vehicle.last_service_date)}</td>
                    <td>
                      <button
                        type="button"
                        className="icon"
                        onClick={() => setSelectedVehicle(vehicle)}
                        title="View vehicle"
                        aria-label={`View ${vehicle.registration_number}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty">
                    No vehicles match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Add Vehicle */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <section
            className="vehicle-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-vehicle-title"
          >
            <div className="modal-head">
              <div>
                <span>Fleet Registration</span>
                <h2 id="add-vehicle-title">Add Vehicle</h2>
              </div>

              <button
                type="button"
                className="icon"
                onClick={closeAddModal}
                disabled={saving}
                aria-label="Close add vehicle modal"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={addVehicle} className="vehicle-form">
              <label>
                Registration number
                <input
                  type="text"
                  name="registration_number"
                  value={form.registration_number}
                  onChange={updateForm}
                  placeholder="LAG-SW-003"
                  autoComplete="off"
                  required
                />
              </label>

              <label>
                Vehicle type
                <select
                  name="vehicle_type"
                  value={form.vehicle_type}
                  onChange={updateForm}
                  required
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((vehicleType) => (
                    <option key={vehicleType} value={vehicleType}>
                      {vehicleType}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Capacity (kg)
                <input
                  type="number"
                  name="capacity_kg"
                  min="1"
                  step="1"
                  value={form.capacity_kg}
                  onChange={updateForm}
                  placeholder="1000"
                  required
                />
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={form.status}
                  onChange={updateForm}
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="full">
                Last service date
                <input
                  type="date"
                  name="last_service_date"
                  value={form.last_service_date}
                  onChange={updateForm}
                />
              </label>

              <div className="modal-actions full">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeAddModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Vehicle"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal: View Details */}
      {selectedVehicle && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedVehicle(null);
          }}
        >
          <section
            className="vehicle-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-profile-title"
          >
            <div className="modal-head">
              <div>
                <span>Vehicle Profile</span>
                <h2 id="vehicle-profile-title">
                  {selectedVehicle.registration_number}
                </h2>
              </div>

              <button
                type="button"
                className="icon"
                onClick={() => setSelectedVehicle(null)}
                aria-label="Close vehicle details"
              >
                <X size={19} />
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>Vehicle type</span>
                <strong>{selectedVehicle.vehicle_type || "—"}</strong>
              </div>

              <div>
                <span>Capacity</span>
                <strong>
                  {selectedVehicle.capacity_kg
                    ? `${Number(selectedVehicle.capacity_kg).toLocaleString()} kg`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>Assigned collector</span>
                <strong>
                  {getCollectorName(selectedVehicle.assigned_collector)}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <StatusBadge status={selectedVehicle.status} />
              </div>

              <div>
                <span>Last service</span>
                <strong>
                  {formatDate(selectedVehicle.last_service_date)}
                </strong>
              </div>

              <div>
                <span>Fleet ID</span>
                <strong>{selectedVehicle.id ?? "—"}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}