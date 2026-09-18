import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import api from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/payments.css";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizePayment(payment = {}) {
  return {
    ...payment,
    id: payment.id ?? payment.invoice_id,
    reference:
      payment.reference ??
      payment.invoice_reference ??
      payment.transaction_reference ??
      `INV-${payment.id ?? "—"}`,
    status: String(payment.status ?? "pending").toLowerCase(),
    total:
      payment.total ??
      payment.amount ??
      payment.total_amount ??
      0,
    customer:
      payment.customer ??
      payment.user ??
      payment.pickup?.customer ??
      null,
    pickup:
      payment.pickup ??
      payment.pickup_request ??
      null,
    provider:
      payment.provider ??
      payment.payment_provider ??
      "—",
    created_at:
      payment.created_at ??
      payment.payment_date ??
      null,
  };
}

function getErrorMessage(error) {
  if (!error.response) {
    return "Unable to connect to the backend. Confirm that Flask is running.";
  }

  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    `Unable to load payments. HTTP ${error.response.status}.`
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    total_revenue: 0,
    paid_count: 0,
    pending_count: 0,
    failed_count: 0,
  });
  const [meta, setMeta] = useState({
    page: 1,
    pages: 1,
    total: 0,
    per_page: PAGE_SIZE,
  });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPayments(targetPage = page, targetStatus = status) {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/payments", {
        params: {
          page: targetPage,
          per_page: PAGE_SIZE,
          ...(targetStatus ? { status: targetStatus } : {}),
        },
      });

      const rows =
        response.data?.items ??
        response.data?.payments ??
        [];

      setPayments(
        Array.isArray(rows)
          ? rows.map(normalizePayment)
          : [],
      );

      setSummary(
        response.data?.summary || {
          total_revenue: 0,
          paid_count: 0,
          pending_count: 0,
          failed_count: 0,
        },
      );

      setMeta(
        response.data?.meta || {
          page: targetPage,
          pages: 1,
          total: Array.isArray(rows) ? rows.length : 0,
          per_page: PAGE_SIZE,
        },
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments(page, status);
  }, [page, status]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return payments;

    return payments.filter((payment) =>
      [
        payment.reference,
        payment.customer?.full_name,
        payment.customer?.email,
        payment.pickup?.reference,
        payment.provider,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [payments, search]);

  function handleStatusChange(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  return (
    <section className="payments-page">
      <header className="payments-heading">
        <div>
          <span className="payments-kicker">
            <CreditCard size={17} />
            Finance
          </span>

          <h1>Payments Management</h1>

          <p>
            Monitor invoices, payment statuses and collection revenue.
          </p>
        </div>

        <button
          type="button"
          className="payments-secondary-btn"
          onClick={() => loadPayments(page, status)}
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
        <div className="payments-feedback error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="payments-summary-grid">
        <article>
          <div className="payments-summary-icon">
            <Banknote size={20} />
          </div>
          <div>
            <span>Total Revenue</span>
            <strong>
              {formatCurrency(summary.total_revenue)}
            </strong>
            <small>Paid invoices</small>
          </div>
        </article>

        <article>
          <div className="payments-summary-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Paid</span>
            <strong>{summary.paid_count || 0}</strong>
            <small>Completed payments</small>
          </div>
        </article>

        <article>
          <div className="payments-summary-icon">
            <Clock3 size={20} />
          </div>
          <div>
            <span>Pending</span>
            <strong>{summary.pending_count || 0}</strong>
            <small>Awaiting payment</small>
          </div>
        </article>

        <article>
          <div className="payments-summary-icon">
            <XCircle size={20} />
          </div>
          <div>
            <span>Failed</span>
            <strong>{summary.failed_count || 0}</strong>
            <small>Require attention</small>
          </div>
        </article>
      </section>

      <section className="payments-panel">
        <div className="payments-panel-heading">
          <div>
            <h2>Invoices and Payments</h2>
            <p>{meta.total || 0} record(s) found</p>
          </div>
        </div>

        <div className="payments-filters">
          <label className="payments-search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search invoice, customer, pickup or provider"
            />
          </label>

          <select
            value={status}
            onChange={handleStatusChange}
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value || "all"}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Pickup</th>
                <th>Amount</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="payments-empty"
                  >
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id || payment.reference}>
                    <td>
                      <strong>{payment.reference}</strong>
                    </td>

                    <td>
                      <strong>
                        {payment.customer?.full_name || "—"}
                      </strong>
                      <span className="payments-subtext">
                        {payment.customer?.email || ""}
                      </span>
                    </td>

                    <td>
                      {payment.pickup?.reference || "—"}
                    </td>

                    <td>
                      <strong>
                        {formatCurrency(payment.total)}
                      </strong>
                    </td>

                    <td>{payment.provider || "—"}</td>

                    <td>
                      <StatusBadge status={payment.status} />
                    </td>

                    <td>{formatDate(payment.created_at)}</td>

                    <td>
                      <button
                        type="button"
                        className="payments-icon-btn"
                        title="View payment"
                        onClick={() =>
                          setSelectedPayment(payment)
                        }
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="payments-empty"
                  >
                    No payment records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="payments-pagination">
          <span>
            Page {meta.page || 1} of {meta.pages || 1}
          </span>

          <div>
            <button
              type="button"
              disabled={(meta.page || 1) <= 1 || loading}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <button
              type="button"
              disabled={
                (meta.page || 1) >= (meta.pages || 1) ||
                loading
              }
              onClick={() =>
                setPage((current) => current + 1)
              }
            >
              Next
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {selectedPayment && (
        <div className="payments-modal-backdrop">
          <section
            className="payments-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
          >
            <div className="payments-modal-heading">
              <div>
                <span>Payment Record</span>
                <h2 id="payment-details-title">
                  {selectedPayment.reference}
                </h2>
              </div>

              <button
                type="button"
                className="payments-icon-btn"
                onClick={() => setSelectedPayment(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="payments-details-grid">
              <div>
                <span>Customer</span>
                <strong>
                  {selectedPayment.customer?.full_name || "—"}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {selectedPayment.customer?.email || "—"}
                </strong>
              </div>

              <div>
                <span>Pickup reference</span>
                <strong>
                  {selectedPayment.pickup?.reference || "—"}
                </strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>
                  {formatCurrency(selectedPayment.total)}
                </strong>
              </div>

              <div>
                <span>Provider</span>
                <strong>
                  {selectedPayment.provider || "—"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <StatusBadge status={selectedPayment.status} />
              </div>

              <div>
                <span>Created</span>
                <strong>
                  {formatDate(selectedPayment.created_at)}
                </strong>
              </div>

              <div>
                <span>Record ID</span>
                <strong>{selectedPayment.id ?? "—"}</strong>
              </div>
            </div>

            <div className="payments-modal-actions">
              <button
                type="button"
                className="payments-secondary-btn"
                onClick={() => setSelectedPayment(null)}
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
