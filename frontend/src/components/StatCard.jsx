export default function StatCard({ icon: Icon, value, label, change }) {
  return (
    <article className="stat-card">
      <div className="stat-icon"><Icon size={22} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{change} from last week</small>
      </div>
    </article>
  );
}
