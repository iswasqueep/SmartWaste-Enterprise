import {
  Ban,
  CheckCircle2,
  Eye,
  Power,
  UserCheck,
  UserX,
} from "lucide-react";

import StatusBadge from "./StatusBadge";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRole(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function UserTable({
  users,
  loading,
  onView,
  onApprove,
  onReject,
  onToggleStatus,
}) {
  return (
    <div className="table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Approval</th>
            <th>Account</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan="7" className="users-empty-row">
                Loading registered users...
              </td>
            </tr>
          ) : users.length ? (
            users.map((user) => {
              const isAdmin = user.role === "admin";
              const isPending = user.approval_status === "pending";

              return (
                <tr key={user.id}>
                  <td>
                    <div className="user-identity">
                      <div className="user-avatar">
                        {String(user.full_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <strong>{user.full_name || "Unnamed user"}</strong>
                        <span>{user.email || "No email"}</span>
                      </div>
                    </div>
                  </td>

                  <td>{user.phone || "—"}</td>
                  <td>
                    <span className="role-chip">{formatRole(user.role)}</span>
                  </td>
                  <td>
                    <StatusBadge status={user.approval_status} />
                  </td>
                  <td>
                    <StatusBadge status={user.is_active ? "active" : "inactive"} />
                  </td>
                  <td>{formatDate(user.created_at)}</td>

                  <td>
                    <div className="user-row-actions">
                      <button
                        type="button"
                        className="user-icon-btn"
                        title="View user"
                        onClick={() => onView(user)}
                      >
                        <Eye size={17} />
                      </button>

                      {isPending && !isAdmin && (
                        <>
                          <button
                            type="button"
                            className="user-action-btn approve"
                            onClick={() => onApprove(user)}
                          >
                            <UserCheck size={16} />
                            Approve
                          </button>

                          <button
                            type="button"
                            className="user-action-btn reject"
                            onClick={() => onReject(user)}
                          >
                            <UserX size={16} />
                            Reject
                          </button>
                        </>
                      )}

                      {!isPending && !isAdmin && (
                        <button
                          type="button"
                          className={`user-action-btn ${
                            user.is_active ? "deactivate" : "activate"
                          }`}
                          onClick={() => onToggleStatus(user)}
                        >
                          {user.is_active ? (
                            <>
                              <Ban size={16} />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power size={16} />
                              Activate
                            </>
                          )}
                        </button>
                      )}

                      {isAdmin && (
                        <span className="protected-admin">
                          <CheckCircle2 size={15} />
                          Protected
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="7" className="users-empty-row">
                No users match the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
