import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CirclePlus,
  Clock3,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";
import "../../styles/customer-complaints.css";

const EMPTY_FORM = {
  pickup_id: "",
  subject: "",
  description: "",
};

const STATUS_OPTIONS = [
  {
    value: "",
    label: "All complaints",
  },
  {
    value: "open",
    label: "Open",
  },
  {
    value: "in_progress",
    label: "In progress",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
  {
    value: "closed",
    label: "Closed",
  },
];

function normalizeComplaintResponse(data) {
  const source =
    data?.data ??
    data ??
    {};

  const complaints =
    source.complaints ??
    source.items ??
    source.results ??
    [];

  const pickups =
    source.pickups ??
    source.customer_pickups ??
    [];

  return {
    complaints: Array.isArray(complaints)
      ? complaints
      : [],
    pickups: Array.isArray(pickups)
      ? pickups
      : [],
  };
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function statusLabel(value) {
  return String(value || "open")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function CustomerComplaints() {
  const [complaints, setComplaints] =
    useState([]);

  const [pickups, setPickups] =
    useState([]);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const loadComplaints = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          complaintResponse,
          pickupResponse,
        ] = await Promise.all([
          api.get("/complaints"),
          api.get("/pickups", {
            params: {
              per_page: 100,
            },
          }),
        ]);

        const normalizedComplaints =
          normalizeComplaintResponse(
            complaintResponse.data
          );

        const pickupSource =
          pickupResponse.data?.pickups ??
          pickupResponse.data?.items ??
          pickupResponse.data?.results ??
          [];

        setComplaints(
          normalizedComplaints.complaints
        );

        setPickups(
          Array.isArray(pickupSource)
            ? pickupSource
            : []
        );
      } catch (requestError) {
        console.error(
          "Unable to load complaints:",
          requestError
        );

        setError(
          requestError.response?.data
            ?.error ||
            "Unable to load complaints."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const filteredComplaints =
    useMemo(() => {
      const normalizedSearch =
        searchTerm.trim().toLowerCase();

      return complaints.filter(
        (complaint) => {
          const matchesStatus =
            !statusFilter ||
            complaint.status ===
              statusFilter;

          const searchContent = [
            complaint.reference,
            complaint.subject,
            complaint.description,
            complaint.pickup_reference,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchContent.includes(
              normalizedSearch
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      complaints,
      searchTerm,
      statusFilter,
    ]);

  const summary = useMemo(() => {
    return {
      total: complaints.length,
      open: complaints.filter(
        (item) =>
          item.status === "open"
      ).length,
      inProgress: complaints.filter(
        (item) =>
          item.status ===
          "in_progress"
      ).length,
      resolved: complaints.filter(
        (item) =>
          item.status === "resolved" ||
          item.status === "closed"
      ).length,
    };
  }, [complaints]);

  function handleInputChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openForm() {
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (submitting) {
      return;
    }

    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const subject =
      form.subject.trim();

    const description =
      form.description.trim();

    if (!subject) {
      setError(
        "Complaint subject is required."
      );
      return;
    }

    if (subject.length < 4) {
      setError(
        "Subject must contain at least 4 characters."
      );
      return;
    }

    if (!description) {
      setError(
        "Complaint description is required."
      );
      return;
    }

    if (description.length < 10) {
      setError(
        "Description must contain at least 10 characters."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await api.post(
        "/complaints",
        {
          subject,
          description,
          pickup_id:
            form.pickup_id
              ? Number(form.pickup_id)
              : null,
        }
      );

      setSuccess(
        "Complaint submitted successfully."
      );

      setForm(EMPTY_FORM);
      setShowForm(false);

      await loadComplaints(true);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.error ||
          "Unable to submit complaint."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="customer-complaints-page">
        <div className="complaints-loading-state">
          <LoaderCircle
            size={38}
            className="complaints-spin"
          />

          <h2>
            Loading complaints
          </h2>

          <p>
            Your support requests are
            being prepared.
          </p>
        </div>
      </section>
    );
  }

  return (
    <main className="customer-complaints-page">
      <section className="complaints-hero">
        <div>
          <span className="complaints-eyebrow">
            Help &amp; Support
          </span>

          <h1>Complaints</h1>

          <p>
            Report collection, payment,
            billing or service-related
            issues and track their
            resolution.
          </p>
        </div>

        <button
          type="button"
          className="complaints-primary-button"
          onClick={
            showForm
              ? closeForm
              : openForm
          }
        >
          {showForm ? (
            <>
              <X size={19} />
              Close form
            </>
          ) : (
            <>
              <CirclePlus size={19} />
              New complaint
            </>
          )}
        </button>
      </section>

      {error && (
        <div className="complaints-alert complaints-alert-error">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="complaints-alert complaints-alert-success">
          <CheckCircle2 size={19} />
          <span>{success}</span>
        </div>
      )}

      <section className="complaints-summary-grid">
        <article className="complaint-summary-card">
          <span>Total complaints</span>
          <strong>{summary.total}</strong>
          <small>
            All support requests
          </small>
        </article>

        <article className="complaint-summary-card">
          <span>Open</span>
          <strong>{summary.open}</strong>
          <small>
            Awaiting attention
          </small>
        </article>

        <article className="complaint-summary-card">
          <span>In progress</span>
          <strong>
            {summary.inProgress}
          </strong>
          <small>
            Currently being reviewed
          </small>
        </article>

        <article className="complaint-summary-card">
          <span>Resolved</span>
          <strong>
            {summary.resolved}
          </strong>
          <small>
            Completed support cases
          </small>
        </article>
      </section>

      {showForm && (
        <section className="complaints-panel complaint-form-panel">
          <div className="complaints-panel-header">
            <div>
              <span className="complaints-section-label">
                Create request
              </span>

              <h2>
                Submit a complaint
              </h2>

              <p>
                Provide clear details so
                the support team can
                investigate quickly.
              </p>
            </div>

            <div className="complaints-panel-icon">
              <MessageSquareWarning
                size={26}
              />
            </div>
          </div>

          <form
            className="complaint-form"
            onSubmit={handleSubmit}
          >
            <div className="complaint-form-grid">
              <div className="complaint-field">
                <label htmlFor="pickup_id">
                  Related pickup
                </label>

                <div className="complaint-select-wrapper">
                  <select
                    id="pickup_id"
                    name="pickup_id"
                    value={form.pickup_id}
                    onChange={
                      handleInputChange
                    }
                  >
                    <option value="">
                      General complaint
                    </option>

                    {pickups.map(
                      (pickup) => (
                        <option
                          value={pickup.id}
                          key={pickup.id}
                        >
                          {pickup.reference ||
                            `Pickup #${pickup.id}`}
                          {pickup.status
                            ? ` — ${statusLabel(
                                pickup.status
                              )}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={18}
                  />
                </div>
              </div>

              <div className="complaint-field">
                <label htmlFor="subject">
                  Subject
                </label>

                <input
                  id="subject"
                  name="subject"
                  type="text"
                  value={form.subject}
                  onChange={
                    handleInputChange
                  }
                  placeholder="Enter a concise complaint subject"
                  maxLength={150}
                />

                <small>
                  {form.subject.length}
                  /150 characters
                </small>
              </div>

              <div className="complaint-field complaint-field-full">
                <label htmlFor="description">
                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleInputChange
                  }
                  placeholder="Describe the issue clearly, including what happened and when it occurred."
                  rows={6}
                  maxLength={2000}
                />

                <small>
                  {form.description.length}
                  /2000 characters
                </small>
              </div>
            </div>

            <div className="complaint-form-actions">
              <button
                type="button"
                className="complaints-secondary-button"
                onClick={closeForm}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="complaints-submit-button"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="complaints-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Submit complaint
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="complaints-panel">
        <div className="complaints-panel-header complaints-list-heading">
          <div>
            <span className="complaints-section-label">
              Support history
            </span>

            <h2>My complaints</h2>

            <p>
              Review submitted requests
              and their current status.
            </p>
          </div>

          <button
            type="button"
            className="complaints-refresh-button"
            onClick={() =>
              loadComplaints(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "complaints-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing"
              : "Refresh"}
          </button>
        </div>

        <div className="complaints-toolbar">
          <div className="complaints-search">
            <Search size={18} />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Search complaints..."
            />
          </div>

          <div className="complaints-filter">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <ChevronDown size={17} />
          </div>
        </div>

        {filteredComplaints.length ===
        0 ? (
          <div className="complaints-empty-state">
            <div className="complaints-empty-icon">
              <MessageSquareWarning
                size={32}
              />
            </div>

            <h3>
              {complaints.length === 0
                ? "No complaints submitted"
                : "No matching complaints"}
            </h3>

            <p>
              {complaints.length === 0
                ? "You have not submitted any complaints. Create one whenever you need assistance."
                : "Try changing your search text or status filter."}
            </p>

            {complaints.length === 0 &&
              !showForm && (
                <button
                  type="button"
                  onClick={openForm}
                  className="complaints-empty-button"
                >
                  <CirclePlus
                    size={18}
                  />
                  Submit a complaint
                </button>
              )}
          </div>
        ) : (
          <div className="complaints-card-list">
            {filteredComplaints.map(
              (complaint) => (
                <article
                  className="complaint-item-card"
                  key={complaint.id}
                >
                  <div className="complaint-item-top">
                    <div>
                      <span className="complaint-reference">
                        {complaint.reference ||
                          `Complaint #${complaint.id}`}
                      </span>

                      <h3>
                        {complaint.subject}
                      </h3>
                    </div>

                    <span
                      className={`complaint-status complaint-status-${String(
                        complaint.status ||
                          "open"
                      ).replaceAll(
                        "_",
                        "-"
                      )}`}
                    >
                      {statusLabel(
                        complaint.status
                      )}
                    </span>
                  </div>

                  <p className="complaint-description">
                    {complaint.description}
                  </p>

                  <div className="complaint-item-meta">
                    <span>
                      <Clock3 size={15} />
                      {formatDate(
                        complaint.created_at
                      )}
                    </span>

                    {complaint.pickup_reference && (
                      <span>
                        Pickup:{" "}
                        {
                          complaint.pickup_reference
                        }
                      </span>
                    )}
                  </div>

                  {complaint.admin_response && (
                    <div className="complaint-response">
                      <strong>
                        Support response
                      </strong>

                      <p>
                        {
                          complaint.admin_response
                        }
                      </p>
                    </div>
                  )}
                </article>
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default CustomerComplaints;