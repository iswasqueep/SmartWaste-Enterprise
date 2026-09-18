import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/collectors.css";

function humanize(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getErrorMessage(error) {
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    "Unable to load collectors."
  );
}

function getCollectorName(profile) {
  return profile?.user?.full_name || "Unnamed Collector";
}

function getVehicleRegistration(profile) {
  return (
    profile?.vehicle?.registration_number ||
    profile?.assigned_vehicle?.registration_number ||
    "Unassigned"
  );
}

export default function Collectors() {
  const [collectors, setCollectors] = useState([]);
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("");
  const [approval, setApproval] = useState("");
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [assigningVehicle, setAssigningVehicle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCollectors() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/collectors");
      setCollectors(response.data?.items || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollectors();
  }, []);

  async function loadVehicles() {
    try {
      setVehicleLoading(true);
      setError("");

      const response = await api.get("/admin/vehicles");
      setVehicles(response.data?.items || []);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to load vehicles.",
        ),
      );
    } finally {
      setVehicleLoading(false);
    }
  }

  async function handleAssignVehicle() {
    if (!selectedCollector || !selectedVehicleId) {
      setError("Please select a vehicle.");
      return;
    }

    try {
      setAssigningVehicle(true);
      setError("");
      setMessage("");

      const response = await api.patch(
        `/admin/collectors/${selectedCollector.id}/vehicle`,
        {
          vehicle_id: Number(selectedVehicleId),
        },
      );

      const updatedCollector = response.data?.collector;

      if (updatedCollector) {
        setSelectedCollector(updatedCollector);
        setCollectors((current) =>
          current.map((profile) =>
            profile.id === updatedCollector.id
              ? updatedCollector
              : profile,
          ),
        );
      }

      setSelectedVehicleId("");
      setMessage(
        response.data?.message ||
          "Vehicle assigned to collector.",
      );
      await loadVehicles();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to assign vehicle.",
        ),
      );
    } finally {
      setAssigningVehicle(false);
    }
  }

  const filteredCollectors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return collectors.filter((profile) => {
      const user = profile?.user || {};

      const matchesSearch =
        !query ||
        [
          user.full_name,
          user.email,
          user.phone,
          profile.operating_area,
          profile.availability_status,
          profile.vehicle?.registration_number,
          profile.assigned_vehicle?.registration_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesAvailability =
        !availability ||
        profile.availability_status === availability;

      const matchesApproval =
        !approval || user.approval_status === approval;

      return (
        matchesSearch &&
        matchesAvailability &&
        matchesApproval
      );
    });
  }, [collectors, search, availability, approval]);

  const stats = useMemo(() => {
    const total = collectors.length;

    const available = collectors.filter(
      (profile) =>
        profile.availability_status === "available",
    ).length;

    const assigned = collectors.filter(
      (profile) =>
        profile.availability_status === "assigned",
    ).length;

    const approved = collectors.filter(
      (profile) =>
        profile?.user?.approval_status === "approved" &&
        profile?.user?.is_active,
    ).length;

    return { total, available, assigned, approved };
  }, [collectors]);

  return (
    <section className="collectors-page">
      <header className="collectors-heading">
        <div>
          <span className="collectors-kicker">Workforce</span>
          <h1>Collector Management</h1>
          <p>
            Monitor approved collectors, operating areas,
            availability and vehicle assignments.
          </p>
        </div>

        <button
          type="button"
          className="collector-secondary-btn"
          onClick={loadCollectors}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="collector-feedback error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="collector-summary-grid">
        <article>
          <div className="collector-summary-icon">
            <Users size={20} />
          </div>
          <div>
            <span>Total Collectors</span>
            <strong>{stats.total}</strong>
            <small>Registered collector profiles</small>
          </div>
        </article>

        <article>
          <div className="collector-summary-icon">
            <UserCheck size={20} />
          </div>
          <div>
            <span>Approved and Active</span>
            <strong>{stats.approved}</strong>
            <small>Eligible for assignment</small>
          </div>
        </article>

        <article>
          <div className="collector-summary-icon">
            <MapPin size={20} />
          </div>
          <div>
            <span>Available</span>
            <strong>{stats.available}</strong>
            <small>Ready for pickup assignment</small>
          </div>
        </article>

        <article>
          <div className="collector-summary-icon">
            <Truck size={20} />
          </div>
          <div>
            <span>Currently Assigned</span>
            <strong>{stats.assigned}</strong>
            <small>Handling active operations</small>
          </div>
        </article>
      </section>

      <section className="collector-panel">
        <div className="collector-panel-heading">
          <div>
            <h2>All Collectors</h2>
            <p>
              {filteredCollectors.length} collector(s) displayed
            </p>
          </div>
        </div>

        <div className="collector-filters">
          <label className="collector-search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, email, phone, area or vehicle"
            />
          </label>

          <select
            value={availability}
            onChange={(event) =>
              setAvailability(event.target.value)
            }
          >
            <option value="">All availability</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="unavailable">Unavailable</option>
          </select>

          <select
            value={approval}
            onChange={(event) =>
              setApproval(event.target.value)
            }
          >
            <option value="">All approvals</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="collector-table-wrap">
          <table className="collector-table">
            <thead>
              <tr>
                <th>Collector</th>
                <th>Contact</th>
                <th>Operating Area</th>
                <th>Vehicle</th>
                <th>Availability</th>
                <th>Approval</th>
                <th>Account</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="collector-empty">
                    Loading collectors...
                  </td>
                </tr>
              ) : filteredCollectors.length ? (
                filteredCollectors.map((profile) => (
                  <tr key={profile.id || profile.user?.id}>
                    <td>
                      <strong>
                        {getCollectorName(profile)}
                      </strong>
                      <span className="collector-subtext">
                        Collector ID:{" "}
                        {profile.user?.id || profile.id || "—"}
                      </span>
                    </td>

                    <td>
                      <div>
                        {profile.user?.email || "—"}
                      </div>
                      <span className="collector-subtext">
                        {profile.user?.phone || ""}
                      </span>
                    </td>

                    <td>
                      {profile.operating_area || "Not specified"}
                    </td>

                    <td>
                      <strong>
                        {getVehicleRegistration(profile)}
                      </strong>
                      <span className="collector-subtext">
                        {profile.vehicle?.vehicle_type ||
                          profile.assigned_vehicle?.vehicle_type ||
                          ""}
                      </span>
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          profile.availability_status ||
                          "unavailable"
                        }
                      />
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          profile.user?.approval_status ||
                          "pending"
                        }
                      />
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          profile.user?.is_active
                            ? "active"
                            : "inactive"
                        }
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="collector-icon-btn"
                        title="View collector"
                        onClick={() => {
                          setSelectedCollector(profile);
                          setSelectedVehicleId("");
                          setMessage("");
                          setError("");
                          loadVehicles();
                        }}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="collector-empty">
                    No collectors match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCollector && (
        <div className="collector-modal-backdrop">
          <section className="collector-modal">
            <div className="collector-modal-heading">
              <div>
                <h2>Collector Profile</h2>
                <p>{getCollectorName(selectedCollector)}</p>
              </div>

              <button
                type="button"
                className="collector-icon-btn"
                onClick={() => setSelectedCollector(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="collector-profile-banner">
              <div className="collector-avatar">
                {getCollectorName(selectedCollector)
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h3>{getCollectorName(selectedCollector)}</h3>
                <p>
                  {selectedCollector.user?.email || "—"}
                </p>
              </div>
            </div>

            {message && (
              <div className="collector-feedback success">
                <span>{message}</span>
              </div>
            )}

            <div className="collector-details-grid">
              <div>
                <span>Phone</span>
                <strong>
                  {selectedCollector.user?.phone || "—"}
                </strong>
              </div>

              <div>
                <span>Operating area</span>
                <strong>
                  {selectedCollector.operating_area ||
                    "Not specified"}
                </strong>
              </div>

              <div>
                <span>Availability</span>
                <StatusBadge
                  status={
                    selectedCollector.availability_status ||
                    "unavailable"
                  }
                />
              </div>

              <div>
                <span>Approval status</span>
                <StatusBadge
                  status={
                    selectedCollector.user?.approval_status ||
                    "pending"
                  }
                />
              </div>

              <div>
                <span>Account status</span>
                <StatusBadge
                  status={
                    selectedCollector.user?.is_active
                      ? "active"
                      : "inactive"
                  }
                />
              </div>

              <div>
                <span>Assigned vehicle</span>
                <strong>
                  {getVehicleRegistration(selectedCollector)}
                </strong>
              </div>

              <div>
                <span>Vehicle type</span>
                <strong>
                  {selectedCollector.vehicle?.vehicle_type ||
                    selectedCollector.assigned_vehicle
                      ?.vehicle_type ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Vehicle capacity</span>
                <strong>
                  {selectedCollector.vehicle?.capacity_kg ||
                  selectedCollector.assigned_vehicle?.capacity_kg
                    ? `${
                        selectedCollector.vehicle?.capacity_kg ||
                        selectedCollector.assigned_vehicle
                          ?.capacity_kg
                      } kg`
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="collector-modal-actions">
              <div className="collector-vehicle-assignment">
                <label htmlFor="collector-vehicle">
                  Assign vehicle
                </label>

                <select
                  id="collector-vehicle"
                  value={selectedVehicleId}
                  onChange={(event) =>
                    setSelectedVehicleId(event.target.value)
                  }
                  disabled={vehicleLoading || assigningVehicle}
                >
                  <option value="">
                    {vehicleLoading
                      ? "Loading vehicles..."
                      : "Select an available vehicle"}
                  </option>
                  {vehicles
                    .filter(
                      (vehicle) =>
                        vehicle.status === "available" ||
                        vehicle.id === selectedCollector.vehicle?.id,
                    )
                    .map((vehicle) => (
                      <option
                        key={vehicle.id}
                        value={vehicle.id}
                      >
                        {vehicle.registration_number} — {
                          vehicle.vehicle_type
                        } ({vehicle.capacity_kg} kg)
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  className="collector-primary-btn"
                  onClick={handleAssignVehicle}
                  disabled={!selectedVehicleId || assigningVehicle}
                >
                  {assigningVehicle
                    ? "Assigning..."
                    : selectedCollector.vehicle
                      ? "Change Vehicle"
                      : "Assign Vehicle"}
                </button>
              </div>

              <button
                type="button"
                className="collector-secondary-btn"
                onClick={() => {
                  setSelectedCollector(null);
                  setSelectedVehicleId("");
                  setMessage("");
                }}
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
