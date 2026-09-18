import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  Gift,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  PlusCircle,
  Recycle,
  Truck,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

import "../styles/sidebar-enhancements.css";

const navigationByRole = {
  admin: [
    {
      section: "Overview",
      items: [
        {
          to: "/dashboard/admin",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
      ],
    },
    {
      section: "Operations",
      items: [
        {
          to: "/requests",
          label: "Requests",
          icon: ClipboardList,
        },
        {
          to: "/vehicles",
          label: "Vehicles",
          icon: Truck,
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          to: "/users",
          label: "Users",
          icon: Users,
        },
        {
          to: "/dashboard/admin/collectors",
          label: "Collectors",
          icon: UsersRound,
        },
        {
          to: "/recycling",
          label: "Recycling",
          icon: Recycle,
        },
      ],
    },
    {
      section: "Finance & Analytics",
      items: [
        {
          to: "/dashboard/admin/payments",
          label: "Payments",
          icon: CreditCard,
        },
        {
          to: "/reports",
          label: "Reports",
          icon: BarChart3,
        },
      ],
    },
  ],

  customer: [
    {
      section: "Account",
      items: [
        {
          to: "/dashboard/customer",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        {
          to: "/my-pickups",
          label: "My Pickups",
          icon: ClipboardList,
        },
        {
          to: "/pickup-request",
          label: "New Pickup",
          icon: PlusCircle,
        },
        {
          to: "/payments",
          label: "Payments",
          icon: CreditCard,
        },
        {
          to: "/rewards",
          label: "Rewards",
          icon: Gift,
        },
        {
          to: "/complaints",
          label: "Complaints",
          icon: MessageSquareWarning,
        },
        {
          to: "/notifications",
          label: "Notifications",
          icon: Bell,
        },
        {
          to: "/profile",
          label: "Profile",
          icon: UserRound,
        },
      ],
    },
  ],

  collector: [
    {
      section: "Operations",
      items: [
        {
          to: "/dashboard/collector",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        {
          to: "/collector/pickups",
          label: "Assigned Pickups",
          icon: ClipboardList,
        },
        {
          to: "/requests",
          label: "All Requests",
          icon: ClipboardList,
        },
      ],
    },
  ],

  recycling_company: [
    {
      section: "Operations",
      items: [
        {
          to: "/dashboard/recycling-company",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        {
          to: "/recycling",
          label: "Recycling",
          icon: Recycle,
        },
      ],
    },
  ],

  government: [
    {
      section: "Oversight",
      items: [
        {
          to: "/dashboard/government",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        {
          to: "/recycling",
          label: "Recycling",
          icon: Recycle,
        },
      ],
    },
  ],
};

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem("user");

    return storedUser ? JSON.parse(storedUser) : {};
  } catch (error) {
    console.error("Unable to read stored user:", error);
    return {};
  }
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getStoredUser();

  // Safely normalize role to match object keys reliably
  const normalizedRole = String(user.role || "")
    .trim()
    .toLowerCase();

  const navigationGroups = navigationByRole[normalizedRole] || [];

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Recycle size={24} />
        </span>

        <span>SmartWaste</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigationGroups.map((group) => (
          <section className="sidebar-group" key={group.section}>
            <p className="sidebar-section-label">{group.section}</p>

            <div className="sidebar-group-links">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={Boolean(item.end)}
                    className={({ isActive }) =>
                      `nav-item${isActive ? " active" : ""}`
                    }
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {normalizedRole === "admin" && (
        <div className="sidebar-note">
          <Truck size={20} aria-hidden="true" />
          <div>
            <strong>Fleet online</strong>
            <span>Operations centre active</span>
          </div>
        </div>
      )}

      <div className="profile-card">
        <div className="avatar">
          {(user.full_name || "U").slice(0, 1).toUpperCase()}
        </div>

        <div className="profile-details">
          <strong>{user.full_name || "SmartWaste User"}</strong>
          <span>{user.email || user.role || ""}</span>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}