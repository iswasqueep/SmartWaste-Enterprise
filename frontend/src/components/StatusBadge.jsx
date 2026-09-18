const LABELS = {
  pending: "Pending",
  assigned: "Assigned",
  accepted: "Accepted",
  en_route: "En route",
  collected: "Collected",
  cancelled: "Cancelled",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  "not invoiced": "Not invoiced",
};

export default function StatusBadge({ status }) {
  const normalized = String(status || "unknown")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  const cssClass = normalized.replaceAll("_", "-");
  const label =
    LABELS[normalized] ||
    normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return <span className={`status-badge ${cssClass}`}>{label}</span>;
}
