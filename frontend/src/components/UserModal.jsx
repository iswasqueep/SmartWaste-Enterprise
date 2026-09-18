import {
  Ban,
  Building2,
  Mail,
  MapPin,
  Phone,
  Power,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import StatusBadge from "./StatusBadge";

function formatDateTime(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRole(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ConfirmationModal({ action, loading, onClose, onConfirm }) {
  const isApproval = action.type === "approval";
  const isPositive =
    (isApproval && action.approvalStatus === "approved") ||
    (!isApproval && action.isActive);

  let title = "";
  let description = "";
  let buttonText = "";

  if (isApproval) {
    title =
      action.approvalStatus === "approved"
        ? "Approve user?"
        : "Reject user?";
    description =
      action.approvalStatus === "approved"
        ? `${action.user.full_name} will immediately gain access based on the assigned role.`
        : `${action.user.full_name} will remain unable to access protected system modules.`;
    buttonText =
      action.approvalStatus === "approved" ? "Approve user" : "Reject user";
  } else {
    title = action.isActive ? "Activate account?" : "Deactivate account?";
    description = action.isActive
      ? `${action.user.full_name} will be allowed to sign in again.`
      : `${action.user.full_name} will lose access until an administrator reactivates the account.`;
    buttonText = action.isActive ? "Activate account" : "Deactivate account";
  }

  return (
    <div className="user-modal-backdrop">
      <section className="user-modal confirm-modal" role="dialog" aria-modal="true">
        <div className={`confirm-icon ${isPositive ? "positive" : "negative"}`}>
          {isPositive ? <UserCheck size={28} /> : <UserX size={28} />}
        </div>

        <h2>{title}</h2>
        <p>{description}</p>

        <div className="user-modal-actions">
          <button type="button" className="users-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={isPositive ? "users-primary-btn" : "users-danger-btn"}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Saving..." : buttonText}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function UserModal({
  mode,
  user,
  action,
  loading,
  onClose,
  onConfirm,
  onApprove,
  onReject,
  onToggleStatus,
}) {
  if (mode === "confirm") {
    return (
      <ConfirmationModal
        action={action}
        loading={loading}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
  }

  const isAdmin = user.role === "admin";
  const isPending = user.approval_status === "pending";

  return (
    <div className="user-modal-backdrop">
      <section className="user-modal" role="dialog" aria-modal="true">
        <div className="user-modal-heading">
          <div>
            <span>User profile</span>
            <h2>{user.full_name || "Unnamed user"}</h2>
          </div>

          <button
            type="button"
            className="user-icon-btn"
            onClick={onClose}
            aria-label="Close user profile"
          >
            <X size={19} />
          </button>
        </div>

        <div className="profile-banner">
          <div className="profile-avatar">
            {String(user.full_name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{formatRole(user.role)}</strong>
            <span>Registered {formatDateTime(user.created_at)}</span>
          </div>
        </div>

        <div className="user-detail-grid">
          <div>
            <Mail size={17} />
            <span>Email</span>
            <strong>{user.email || "—"}</strong>
          </div>
          <div>
            <Phone size={17} />
            <span>Phone</span>
            <strong>{user.phone || "—"}</strong>
          </div>
          <div>
            <ShieldCheck size={17} />
            <span>Approval</span>
            <StatusBadge status={user.approval_status} />
          </div>
          <div>
            <Power size={17} />
            <span>Account</span>
            <StatusBadge status={user.is_active ? "active" : "inactive"} />
          </div>
          <div>
            <Building2 size={17} />
            <span>Organisation</span>
            <strong>{user.organisation_name || user.company_name || "—"}</strong>
          </div>
          <div>
            <MapPin size={17} />
            <span>Identification</span>
            <strong>{user.identification_number || "—"}</strong>
          </div>
        </div>

        {!isAdmin && (
          <div className="user-modal-actions">
            {isPending ? (
              <>
                <button
                  type="button"
                  className="users-danger-btn"
                  onClick={() => onReject(user)}
                >
                  <UserX size={17} />
                  Reject
                </button>
                <button
                  type="button"
                  className="users-primary-btn"
                  onClick={() => onApprove(user)}
                >
                  <UserCheck size={17} />
                  Approve
                </button>
              </>
            ) : (
              <button
                type="button"
                className={
                  user.is_active ? "users-danger-btn" : "users-primary-btn"
                }
                onClick={() => onToggleStatus(user)}
              >
                {user.is_active ? (
                  <>
                    <Ban size={17} />
                    Deactivate account
                  </>
                ) : (
                  <>
                    <Power size={17} />
                    Activate account
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
