import {
  Building2,
  CircleUserRound,
  Clock3,
  Recycle,
  ShieldCheck,
  Truck,
} from "lucide-react";

const cards = [
  { key: "total", label: "Total Users", icon: CircleUserRound },
  { key: "customers", label: "Customers", icon: ShieldCheck },
  { key: "collectors", label: "Collectors", icon: Truck },
  { key: "recycling_companies", label: "Recycling Partners", icon: Recycle },
  { key: "government", label: "Government", icon: Building2 },
  { key: "pending", label: "Pending Approval", icon: Clock3 },
];

export default function UserSummaryCards({ summary }) {
  return (
    <div className="user-summary-grid">
      {cards.map(({ key, label, icon: Icon }) => (
        <article className="user-summary-card" key={key}>
          <div className="user-summary-icon">
            <Icon size={21} />
          </div>
          <div>
            <span>{label}</span>
            <strong>{summary[key] || 0}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
