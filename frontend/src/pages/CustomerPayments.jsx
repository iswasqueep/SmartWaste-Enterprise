import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, FileText, RefreshCw, Search, WalletCards } from "lucide-react";
import api from "../api";
import "../styles/customer-payments.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function statusLabel(value) {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CustomerPayments() {
  const [data, setData] = useState({ summary: {}, invoices: [] });
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [error, setError] = useState("");

  async function loadPayments() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/customer/payments", {
        params: { status: status === "all" ? undefined : status },
      });
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Unable to load your invoices and payments."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, [status]);

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.invoices || [];

    return (data.invoices || []).filter((invoice) =>
      [
        invoice.invoice_number,
        invoice.pickup_reference,
        invoice.status,
        invoice.latest_payment?.provider,
        invoice.latest_payment?.transaction_reference,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [data.invoices, query]);

  async function startPayment(invoiceId) {
    setPayingInvoiceId(invoiceId);
    setError("");
    try {
      const response = await api.post(`/customer/invoices/${invoiceId}/pay`);
      const authorizationUrl =
        response.data?.authorization_url || response.data?.payment?.authorization_url;

      if (authorizationUrl) {
        window.location.href = authorizationUrl;
        return;
      }
      await loadPayments();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Unable to start payment."
      );
    } finally {
      setPayingInvoiceId(null);
    }
  }

  const summary = data.summary || {};

  return (
    <main className="customer-payments-page">
      <section className="customer-payments-header">
        <div>
          <span className="customer-payments-eyebrow">
            <WalletCards size={17} /> My finances
          </span>
          <h1>Invoices and payments</h1>
          <p>Review your waste collection invoices and pay outstanding balances securely.</p>
        </div>

        <button type="button" className="customer-payments-refresh" onClick={loadPayments} disabled={loading}>
          <RefreshCw size={18} /> Refresh
        </button>
      </section>

      {error ? (
        <div className="customer-payments-error" role="alert">
          <AlertCircle size={20} /> <span>{error}</span>
        </div>
      ) : null}

      <section className="customer-payment-summary">
        <article>
          <span className="summary-icon summary-icon--amber"><FileText size={21} /></span>
          <div>
            <small>Outstanding balance</small>
            <strong>{formatCurrency(summary.outstanding_balance)}</strong>
            <span>{summary.pending_invoices || 0} unpaid invoice(s)</span>
          </div>
        </article>

        <article>
          <span className="summary-icon summary-icon--green"><CheckCircle2 size={21} /></span>
          <div>
            <small>Total paid</small>
            <strong>{formatCurrency(summary.total_paid)}</strong>
            <span>{summary.paid_invoices || 0} paid invoice(s)</span>
          </div>
        </article>

        <article>
          <span className="summary-icon summary-icon--blue"><CreditCard size={21} /></span>
          <div>
            <small>All invoices</small>
            <strong>{summary.total_invoices || 0}</strong>
            <span>Your complete billing history</span>
          </div>
        </article>
      </section>

      <section className="customer-payments-panel">
        <div className="customer-payments-toolbar">
          <div className="customer-payments-search">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or pickup reference" />
          </div>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="customer-payments-state">Loading your invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="customer-payments-state">
            <FileText size={35} />
            <h3>No invoices found</h3>
            <p>New invoices will appear here after a collection has been completed.</p>
          </div>
        ) : (
          <div className="customer-payments-table-wrap">
            <table className="customer-payments-table">
              <thead>
                <tr>
                  <th>Invoice</th><th>Pickup</th><th>Due date</th><th>Total</th><th>Status</th><th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_number}</strong><small>{formatDate(invoice.created_at?.slice(0, 10))}</small></td>
                    <td>{invoice.pickup_reference || "—"}</td>
                    <td>{formatDate(invoice.due_date)}</td>
                    <td><strong>{formatCurrency(invoice.total)}</strong></td>
                    <td><span className={`customer-invoice-status customer-invoice-status--${invoice.status}`}>{statusLabel(invoice.status)}</span></td>
                    <td>
                      {invoice.status === "pending" ? (
                        <button type="button" className="customer-pay-now" disabled={payingInvoiceId === invoice.id} onClick={() => startPayment(invoice.id)}>
                          {payingInvoiceId === invoice.id ? "Starting..." : "Pay now"}
                        </button>
                      ) : invoice.latest_payment ? (
                        <div className="customer-payment-meta"><strong>{statusLabel(invoice.latest_payment.status)}</strong><small>{invoice.latest_payment.provider || "Payment"}</small></div>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
