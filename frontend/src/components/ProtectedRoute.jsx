import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("access_token");
  const storedUser = localStorage.getItem("user");

  if (!token || !storedUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  try {
    JSON.parse(storedUser);
  } catch {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  return children || <Outlet />;
}
