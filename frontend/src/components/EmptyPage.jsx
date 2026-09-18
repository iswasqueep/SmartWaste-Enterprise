export default function EmptyPage({ title, description }) {
  return (
    <section className="panel empty-page">
      <div className="empty-illustration">♻</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="primary-btn">Create new record</button>
    </section>
  );
}
