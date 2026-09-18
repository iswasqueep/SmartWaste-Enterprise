import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Edit3,
  PackageSearch,
  RefreshCw,
  Search,
  Trash2,
  Weight,
  X,
} from "lucide-react";

import api from "../../api";
import "../../styles/customer-pages.css";
import "../../styles/my-pickups.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "accepted", label: "Accepted" },
  { value: "en_route", label: "En route" },
  { value: "collected", label: "Collected" },
  { value: "cancelled", label: "Cancelled" },
];

const initialEditForm = {
  address_id: "",
  waste_category_id: "",
  pickup_date: "",
  preferred_time: "",
  estimated_weight: "",
  notes: "",
};

function getApiError(error, fallbackMessage) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    fallbackMessage
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatStatus(status) {
  return String(status || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatWeight(pickup) {
  const value =
    pickup?.actual_weight ??
    pickup?.estimated_weight;

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? `${numericValue.toLocaleString("en-NG")} kg`
    : `${value} kg`;
}

export default function MyPickups() {
  const [pickups, setPickups] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [categories, setCategories] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [editingPickup, setEditingPickup] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    await Promise.all([
      loadPickups(),
      loadEditOptions(),
    ]);

    setLoading(false);
  }

  async function loadPickups({ silent = false } = {}) {
    if (silent) {
      setRefreshing(true);
    }

    setError("");

    try {
      const response = await api.get("/pickups");

      const pickupData =
        response.data?.pickups ??
        response.data?.items ??
        response.data?.data ??
        response.data ??
        [];

      setPickups(
        Array.isArray(pickupData)
          ? pickupData
          : []
      );
    } catch (requestError) {
      setPickups([]);
      setError(
        getApiError(
          requestError,
          "Unable to load your pickup requests."
        )
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function loadEditOptions() {
    try {
      const [addressResponse, categoryResponse] =
        await Promise.all([
          api.get("/profile/addresses"),
          api.get("/public/waste-categories"),
        ]);

      const addressData =
        addressResponse.data?.addresses ??
        addressResponse.data ??
        [];

      const categoryData =
        categoryResponse.data?.categories ??
        categoryResponse.data ??
        [];

      setAddresses(
        Array.isArray(addressData)
          ? addressData
          : []
      );

      setCategories(
        Array.isArray(categoryData)
          ? categoryData
          : []
      );
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          "Unable to load pickup edit options."
        )
      );
    }
  }

  function openEditModal(pickup) {
    setError("");
    setMessage("");
    setEditingPickup(pickup);

    setEditForm({
      address_id:
        pickup?.address?.id ??
        pickup?.address_id ??
        "",
      waste_category_id:
        pickup?.waste_category?.id ??
        pickup?.waste_category_id ??
        "",
      pickup_date:
        pickup?.pickup_date || "",
      preferred_time:
        pickup?.preferred_time || "",
      estimated_weight:
        pickup?.estimated_weight ?? "",
      notes:
        pickup?.notes || "",
    });
  }

  function closeEditModal() {
    setEditingPickup(null);
    setEditForm(initialEditForm);
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (!editingPickup) return;

    setSavingEdit(true);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(
        `/pickups/${editingPickup.id}`,
        {
          address_id: Number(editForm.address_id),
          waste_category_id: Number(
            editForm.waste_category_id
          ),
          pickup_date: editForm.pickup_date,
          preferred_time: editForm.preferred_time,
          estimated_weight: Number(
            editForm.estimated_weight
          ),
          notes: editForm.notes.trim(),
        }
      );

      setMessage(
        response.data?.message ||
          "Pickup request updated successfully."
      );

      closeEditModal();
      await loadPickups({ silent: true });
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          "Unable to update pickup request."
        )
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function deletePickup(pickup) {
    const confirmed = window.confirm(
      `Delete pickup ${pickup.reference}?`
    );

    if (!confirmed) return;

    setDeletingId(pickup.id);
    setError("");
    setMessage("");

    try {
      const response = await api.delete(
        `/pickups/${pickup.id}`
      );

      setMessage(
        response.data?.message ||
          "Pickup request deleted successfully."
      );

      await loadPickups({ silent: true });
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          "Unable to delete pickup request."
        )
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredPickups = useMemo(() => {
    const normalizedQuery = normalizeText(searchQuery);

    return pickups.filter((pickup) => {
      const pickupStatus = normalizeText(pickup?.status);

      const matchesStatus =
        selectedStatus === "all" ||
        pickupStatus === selectedStatus;

      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;

      return [
        pickup?.reference,
        pickup?.waste_category?.name,
        pickup?.address?.label,
        pickup?.address?.street,
        pickup?.address?.city,
        pickup?.address?.state,
        pickup?.collector?.full_name,
        pickup?.status,
      ].some((value) =>
        normalizeText(value).includes(normalizedQuery)
      );
    });
  }, [pickups, searchQuery, selectedStatus]);

  const summary = useMemo(() => {
    return pickups.reduce(
      (result, pickup) => {
        const status = normalizeText(pickup?.status);

        result.total += 1;

        if (
          ["pending", "assigned", "accepted", "en_route"].includes(status)
        ) {
          result.active += 1;
        }

        if (status === "collected") {
          result.completed += 1;
        }

        return result;
      },
      {
        total: 0,
        active: 0,
        completed: 0,
      }
    );
  }, [pickups]);

  return (
    <main className="customer-page my-pickups-page">
      <header className="my-pickups-header">
        <div>
          <span>COLLECTION HISTORY</span>
          <h1>My pickups</h1>
          <p>
            Track, edit, or delete pending pickup requests.
          </p>
        </div>

        <button
          type="button"
          className="my-pickups-refresh"
          onClick={() =>
            loadPickups({ silent: true })
          }
          disabled={refreshing}
        >
          <RefreshCw size={17} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="my-pickups-alert" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="my-pickups-success" role="status">
          {message}
        </div>
      )}

      <section className="my-pickups-summary">
        <article>
          <PackageSearch size={20} />
          <div>
            <span>Total requests</span>
            <strong>{summary.total}</strong>
          </div>
        </article>

        <article>
          <CalendarDays size={20} />
          <div>
            <span>Active pickups</span>
            <strong>{summary.active}</strong>
          </div>
        </article>

        <article>
          <Weight size={20} />
          <div>
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </div>
        </article>
      </section>

      <section className="my-pickups-card">
        <div className="my-pickups-toolbar">
          <label className="my-pickups-search">
            <Search size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search reference, category, address or collector"
            />
          </label>

          <select
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value)
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="my-pickups-empty">
            Loading your pickup requests...
          </div>
        ) : filteredPickups.length === 0 ? (
          <div className="my-pickups-empty">
            <PackageSearch size={36} />
            <h3>No pickup requests yet</h3>
            <p>
              Your pickup requests will appear here after you create one.
            </p>
          </div>
        ) : (
          <div className="my-pickups-table-wrap">
            <table className="my-pickups-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Address</th>
                  <th>Weight</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredPickups.map((pickup) => {
                  const status =
                    normalizeText(pickup?.status) ||
                    "pending";

                  const canModify =
                    status === "pending";

                  return (
                    <tr key={pickup.id}>
                      <td>
                        <strong>
                          {pickup.reference}
                        </strong>
                      </td>

                      <td>
                        {pickup?.waste_category?.name || "—"}
                      </td>

                      <td>
                        {formatDate(pickup.pickup_date)}
                      </td>

                      <td>
                        {[
                          pickup?.address?.street,
                          pickup?.address?.city,
                          pickup?.address?.state,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>

                      <td>
                        {formatWeight(pickup)}
                      </td>

                      <td>
                        <span
                          className={`my-pickups-status my-pickups-status--${status}`}
                        >
                          {formatStatus(status)}
                        </span>
                      </td>

                      <td>
                        <div className="my-pickups-actions">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(pickup)
                            }
                            disabled={!canModify}
                            title={
                              canModify
                                ? "Edit pickup"
                                : "Only pending pickups can be edited"
                            }
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() =>
                              deletePickup(pickup)
                            }
                            disabled={
                              !canModify ||
                              deletingId === pickup.id
                            }
                            title={
                              canModify
                                ? "Delete pickup"
                                : "Only pending pickups can be deleted"
                            }
                          >
                            <Trash2 size={16} />
                            {deletingId === pickup.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingPickup && (
        <div className="my-pickups-modal-backdrop">
          <section className="my-pickups-modal">
            <div className="my-pickups-modal-header">
              <div>
                <span>EDIT PICKUP</span>
                <h2>{editingPickup.reference}</h2>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                aria-label="Close edit form"
              >
                <X size={19} />
              </button>
            </div>

            <form
              className="my-pickups-edit-form"
              onSubmit={saveEdit}
            >
              <label>
                Pickup address
                <select
                  name="address_id"
                  value={editForm.address_id}
                  onChange={handleEditChange}
                  required
                >
                  <option value="">
                    Select address
                  </option>

                  {addresses.map((address) => (
                    <option
                      key={address.id}
                      value={address.id}
                    >
                      {[
                        address.label,
                        address.street,
                        address.city,
                        address.state,
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Waste category
                <select
                  name="waste_category_id"
                  value={editForm.waste_category_id}
                  onChange={handleEditChange}
                  required
                >
                  <option value="">
                    Select category
                  </option>

                  {categories
                    .filter(
                      (category) =>
                        category.active !== false
                    )
                    .map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Pickup date
                <input
                  type="date"
                  name="pickup_date"
                  value={editForm.pickup_date}
                  min={new Date()
                    .toISOString()
                    .split("T")[0]}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label>
                Preferred time
                <select
                  name="preferred_time"
                  value={editForm.preferred_time}
                  onChange={handleEditChange}
                  required
                >
                  <option value="">
                    Select time
                  </option>
                  <option value="8:00 AM - 10:00 AM">
                    8:00 AM – 10:00 AM
                  </option>
                  <option value="10:00 AM - 12:00 PM">
                    10:00 AM – 12:00 PM
                  </option>
                  <option value="12:00 PM - 2:00 PM">
                    12:00 PM – 2:00 PM
                  </option>
                  <option value="2:00 PM - 4:00 PM">
                    2:00 PM – 4:00 PM
                  </option>
                </select>
              </label>

              <label>
                Estimated weight (kg)
                <input
                  type="number"
                  name="estimated_weight"
                  value={editForm.estimated_weight}
                  min="0.1"
                  step="0.1"
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label className="wide">
                Notes
                <textarea
                  name="notes"
                  rows="4"
                  value={editForm.notes}
                  onChange={handleEditChange}
                />
              </label>

              <div className="my-pickups-modal-actions wide">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={savingEdit}
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
