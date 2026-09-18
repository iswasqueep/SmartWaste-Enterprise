import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

// Public pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Unauthorized from "./pages/Unauthorized";

// Shared and role dashboard pages
import Dashboard from "./pages/Dashboard";
import RoleDashboard from "./pages/RoleDashboard";

// Admin and operational pages
import Collectors from "./pages/Collectors";
import Payments from "./pages/Payments";
import Recycling from "./pages/Recycling";
import Reports from "./pages/Reports";
import Requests from "./pages/Requests";
import Users from "./pages/Users";
import Vehicles from "./pages/Vehicles";

// Customer pages
import CustomerComplaints from "./pages/customer/CustomerComplaints";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerPayments from "./pages/customer/CustomerPayments";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerRewards from "./pages/customer/CustomerRewards";
import MyPickups from "./pages/customer/MyPickups";
import PaymentVerify from "./pages/customer/PaymentVerify";
import PickupRequest from "./pages/customer/PickupRequest";

import CustomerDashboard from "./pages/CustomerDashboard";
import AssignedPickups from "./pages/AssignedPickups";
import GovernmentDashboard from "./pages/GovernmentDashboard";


function getStoredUser() {
  try {
    const storedUser =
      localStorage.getItem("user");

    return storedUser
      ? JSON.parse(storedUser)
      : {};
  } catch (error) {
    console.error(
      "Unable to read stored user:",
      error
    );

    return {};
  }
}


function DashboardRedirect() {
  const user = getStoredUser();

  const normalizedRole = String(
    user.role || ""
  )
    .trim()
    .toLowerCase();

  const dashboardRoutes = {
    customer: "/dashboard/customer",
    collector: "/dashboard/collector",
    recycling_company:
      "/dashboard/recycling-company",
    government:
      "/dashboard/government",
    admin: "/dashboard/admin",
  };

  if (!normalizedRole) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <Navigate
      to={
        dashboardRoutes[
          normalizedRole
        ] || "/unauthorized"
      }
      replace
    />
  );
}


export default function App() {
  return (
    <Routes>
      {/* ==================================================
          PUBLIC ROUTES
      ================================================== */}

      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/unauthorized"
        element={<Unauthorized />}
      />


      {/* ==================================================
          AUTHENTICATED APPLICATION ROUTES
      ================================================== */}

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={<DashboardRedirect />}
        />


        {/* ================================================
            CUSTOMER ROUTES
        ================================================ */}

        <Route
          path="/dashboard/customer"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <CustomerDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/pickup-request"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <PickupRequest />
            </RoleRoute>
          }
        />

        <Route
          path="/my-pickups"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <MyPickups />
            </RoleRoute>
          }
        />

        <Route
          path="/payments"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <CustomerPayments />
            </RoleRoute>
          }
        />

        <Route
          path="/payments/verify"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <PaymentVerify />
            </RoleRoute>
          }
        />

        <Route
          path="/rewards"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <CustomerRewards />
            </RoleRoute>
          }
        />

        <Route
          path="/complaints"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <CustomerComplaints />
            </RoleRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <CustomerNotifications />
            </RoleRoute>
          }
        />
        <Route
    path="/collector/pickups"
    element={<AssignedPickups />}
    />
        <Route
          path="/profile"
          element={
            <RoleRoute
              allowedRoles={[
                "customer",
              ]}
            >
              <CustomerProfile />
            </RoleRoute>
          }
        />


        {/* ================================================
            COLLECTOR ROUTES
        ================================================ */}

        <Route
          path="/dashboard/collector"
          element={
            <RoleRoute
              allowedRoles={[
                "collector",
              ]}
            >
              <RoleDashboard />
            </RoleRoute>
          }
        />


        {/* ================================================
            RECYCLING COMPANY ROUTES
        ================================================ */}

        <Route
          path="/dashboard/recycling-company"
          element={
            <RoleRoute
              allowedRoles={[
                "recycling_company",
              ]}
            >
              <RoleDashboard />
            </RoleRoute>
          }
        />


        {/* ================================================
            GOVERNMENT ROUTES
        ================================================ */}

        <Route
  path="/dashboard/government"
  element={
    <RoleRoute allowedRoles={["government"]}>
      <GovernmentDashboard />
    </RoleRoute>
  }
/>


        {/* ================================================
            ADMIN ROUTES
        ================================================ */}

        <Route
          path="/dashboard/admin"
          element={
            <RoleRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <Dashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/dashboard/admin/payments"
          element={
            <RoleRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <Payments />
            </RoleRoute>
          }
        />

        <Route
          path="/dashboard/admin/collectors"
          element={
            <RoleRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <Collectors />
            </RoleRoute>
          }
        />

        <Route
          path="/vehicles"
          element={
            <RoleRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <Vehicles />
            </RoleRoute>
          }
        />

        <Route
          path="/users"
          element={
            <RoleRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <Users />
            </RoleRoute>
          }
        />


        {/* ================================================
            SHARED OPERATIONAL ROUTES
        ================================================ */}

        <Route
          path="/requests"
          element={
            <RoleRoute
              allowedRoles={[
                "collector",
                "admin",
              ]}
            >
              <Requests />
            </RoleRoute>
          }
        />

        <Route
          path="/recycling"
          element={
            <RoleRoute
              allowedRoles={[
                "recycling_company",
                "government",
                "admin",
              ]}
            >
              <Recycling />
            </RoleRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <RoleRoute
              allowedRoles={[
                "government",
                "admin",
              ]}
            >
              <Reports />
            </RoleRoute>
          }
        />
      </Route>


      {/* ==================================================
          UNKNOWN ROUTES
      ================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/unauthorized"
            replace
          />
        }
      />
    </Routes>
  );
}