import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ maxWidth: 520, textAlign: "center" }}>
        <h1>Access not permitted</h1>
        <p>Your registered account category does not have permission to open this page.</p>
        <Link to="/dashboard">Return to your dashboard</Link>
      </section>
    </main>
  );
}
