import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Shield, 
  Truck, 
  Recycle, 
  Building2, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import api from "../api";

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  confirm_password: "",
  role: "customer",
  identification_number: "",
  operating_area: "",
  company_name: "",
  registration_number: "",
  business_address: "",
  accepted_waste_types: "",
  agency_name: "",
  department: "",
  official_id: "",
};

const rolesConfig = [
  { id: "customer", label: "Resident / Customer", icon: User, desc: "Request pickups & manage waste" },
  { id: "collector", label: "Waste Collector", icon: Truck, desc: "Manage collection routes & jobs" },
  { id: "recycling_company", label: "Recycling Company", icon: Recycle, desc: "Track waste intake & processing" },
  { id: "government", label: "Government Agency", icon: Building2, desc: "Oversight & environmental reports" },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleRoleSelect(selectedRole) {
    setForm((current) => ({ ...current, role: selectedRole }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/register", {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
        operating_area: form.operating_area,
        company_name: form.company_name,
        registration_number: form.registration_number,
        business_address: form.business_address,
        accepted_waste_types: form.accepted_waste_types,
        agency_name: form.agency_name,
        department: form.department,
        official_id: form.official_id,
      });

      setMessage(response.data.message);
      setForm(initialForm);

      if (!response.data.requires_approval) {
        window.setTimeout(() => {
          navigate("/login", {
            state: { registrationMessage: "Registration successful. Sign in with your new details." },
          });
        }, 1000);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Registration failed. Check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main 
      style={{ 
        minHeight: "100vh", 
        padding: "48px 16px", 
        background: "linear-gradient(135deg, #0b2e21 0%, #061c14 100%)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center" 
      }}
    >
      <section
        style={{
          width: "min(100%, 820px)",
          margin: "0 auto",
          padding: "40px",
          borderRadius: "24px",
          background: "#ffffff",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.1)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <Link 
            to="/" 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "8px", 
              color: "#00a651", 
              textDecoration: "none", 
              fontWeight: 600, 
              fontSize: "0.9rem",
              padding: "8px 14px",
              background: "#f0fdf4",
              borderRadius: "50px",
              border: "1px solid #bbf7d0",
              transition: "all 0.2s ease"
            }}
          >
            <ArrowLeft size={16} /> Return to home
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ 
              width: "36px", 
              height: "36px", 
              borderRadius: "10px", 
              background: "#00a651", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              color: "white",
              boxShadow: "0 4px 10px rgba(0, 166, 81, 0.3)"
            }}>
              <Recycle size={20} />
            </div>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#142744", letterSpacing: "-0.5px" }}>
              SmartWaste
            </span>
          </div>
        </div>

        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ color: "#142744", fontSize: "2rem", margin: "0 0 8px 0" }}>Create your SmartWaste account</h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.98rem" }}>
            Select your account category below and fill in the required verification criteria.
          </p>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "12px", color: "#991b1b", marginBottom: "20px", fontSize: "0.9rem" }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {message && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", color: "#166534", marginBottom: "20px", fontSize: "0.9rem" }}>
            <CheckCircle2 size={18} /> {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Account Role Selector Cards */}
          <div>
            <label style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "10px", fontSize: "0.95rem" }}>
              Account category
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: "12px" }}>
              {rolesConfig.map((item) => {
                const IconComponent = item.icon;
                const isSelected = form.role === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleRoleSelect(item.id)}
                    style={{
                      padding: "16px 14px",
                      borderRadius: "14px",
                      border: isSelected ? "2px solid #00a651" : "1px solid #e2e8f0",
                      background: isSelected ? "#f0fdf4" : "#f8fafc",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}
                  >
                    <div style={{ color: isSelected ? "#00a651" : "#64748b" }}>
                      <IconComponent size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: isSelected ? "#14532d" : "#1e293b", fontSize: "0.9rem" }}>{item.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", lineHeight: "1.2" }}>{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />

          {/* Personal Information Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
              Full name or contact person *
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <User size={18} style={{ position: "absolute", left: "14px", color: "#94a3b8" }} />
                <input 
                  name="full_name" 
                  value={form.full_name} 
                  onChange={handleChange} 
                  placeholder="e.g. John Doe"
                  style={{ width: "100%", padding: "12px 12px 12px 44px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.95rem", outline: "none", background: "#fff" }} 
                  required 
                />
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
              Email address *
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Mail size={18} style={{ position: "absolute", left: "14px", color: "#94a3b8" }} />
                <input 
                  name="email" 
                  type="email" 
                  value={form.email} 
                  onChange={handleChange} 
                  placeholder="name@example.com"
                  style={{ width: "100%", padding: "12px 12px 12px 44px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.95rem", outline: "none", background: "#fff" }} 
                  required 
                />
              </div>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
              Phone number
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Phone size={18} style={{ position: "absolute", left: "14px", color: "#94a3b8" }} />
                <input 
                  name="phone" 
                  type="tel" 
                  value={form.phone} 
                  onChange={handleChange} 
                  placeholder="+234 ..."
                  style={{ width: "100%", padding: "12px 12px 12px 44px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.95rem", outline: "none", background: "#fff" }} 
                />
              </div>
            </label>
          </div>

          {/* Role-Specific Fields */}
          {form.role === "collector" && (
            <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#1e293b" }}>Collector Details</h3>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                Collector Identification Number
                <input
                  type="text"
                  value="Generated automatically after approval"
                  disabled
                  style={{
                    width: "100%", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "0.95px",
                    background: "#f1f5f9",
                    color: "#64748b",
                    cursor: "not-allowed",
                  }}
                />
                <small style={{ color: "#64748b", fontSize: "12px" }}>
                  Assigned automatically after administrative approval.
                </small>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                Operating Area *
                <input
                  name="operating_area"
                  value={form.operating_area}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.95rem", background: "#fff" }}
                  placeholder="e.g. Ikeja, Lagos Mainland"
                  required
                />
              </label>
            </div>
          )}

          {form.role === "recycling_company" && (
            <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#1e293b" }}>Recycling Company Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                  Company name *
                  <input name="company_name" value={form.company_name} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }} required />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                  Registration number *
                  <input name="registration_number" value={form.registration_number} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }} required />
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                Business address *
                <input name="business_address" value={form.business_address} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }} required />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                Accepted waste types
                <textarea name="accepted_waste_types" value={form.accepted_waste_types} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff", fontFamily: "inherit" }} rows={3} placeholder="e.g., Plastics, Glass, Electronics" />
              </label>
            </div>
          )}

          {form.role === "government" && (
            <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#1e293b" }}>Government Agency Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                  Agency name *
                  <input name="agency_name" value={form.agency_name} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }} required />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                  Department
                  <input name="department" value={form.department} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }} />
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
                Official identification number *
                <input name="official_id" value={form.official_id} onChange={handleChange} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }} required />
              </label>
            </div>
          )}

          {/* Passwords Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
              Password *
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock size={18} style={{ position: "absolute", left: "14px", color: "#94a3b8" }} />
                <input 
                  name="password" 
                  type="password" 
                  value={form.password} 
                  onChange={handleChange} 
                  minLength={8} 
                  placeholder="At least 8 characters"
                  style={{ width: "100%", padding: "12px 12px 12px 44px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.95rem", background: "#fff" }} 
                  required 
                />
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500, color: "#334155", fontSize: "0.9rem" }}>
              Confirm password *
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Shield size={18} style={{ position: "absolute", left: "14px", color: "#94a3b8" }} />
                <input 
                  name="confirm_password" 
                  type="password" 
                  value={form.confirm_password} 
                  onChange={handleChange} 
                  minLength={8} 
                  placeholder="Re-enter password"
                  style={{ width: "100%", padding: "12px 12px 12px 44px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "0.95rem", background: "#fff" }} 
                  required 
                />
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 20px",
              border: 0,
              borderRadius: "12px",
              background: "#00a651",
              color: "white",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              transition: "background 0.2s ease",
              marginTop: "8px",
              boxShadow: "0 4px 12px rgba(0, 166, 81, 0.2)"
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", color: "#64748b", fontSize: "0.9rem" }}>
          Already registered? <Link to="/login" style={{ color: "#00a651", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}