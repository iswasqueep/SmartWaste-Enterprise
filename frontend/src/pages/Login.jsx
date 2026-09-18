import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/login.css";

const dashboardByRole = {
  customer: "/dashboard/customer",
  collector: "/dashboard/collector",
  recycling_company: "/dashboard/recycling-company",
  government: "/dashboard/government",
  admin: "/dashboard/admin",
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.registrationMessage || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("access_token");

    if (storedUser && token) {
      try {
        const user = JSON.parse(storedUser);
        navigate(dashboardByRole[user.role] || "/dashboard", { replace: true });
      } catch {
        localStorage.clear();
      }
    }
  }, [navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: form.email.trim(),
        password: form.password,
      });

      const { access_token, refresh_token, user } = response.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate(dashboardByRole[user.role] || "/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to sign in. Check your credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-page">
      <div className="login-background-shape login-shape-one" />
      <div className="login-background-shape login-shape-two" />

      <Link to="/" className="login-home-link">← Return to website</Link>

      <div className="login-panel">
        <Link to="/" className="login-brand"><span>♻</span>SmartWaste</Link>

        <div className="login-heading">
          <span className="login-kicker">Secure user portal</span>
          <h1>Welcome back</h1>
          <p>Sign in using the email and password you supplied during registration.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {message && <div className="login-success">{message}</div>}
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your registered email"
              autoComplete="email"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
        </form>

        <p>New to SmartWaste? <Link to="/register">Create an account</Link></p>
      </div>
    </div>
  );
}
