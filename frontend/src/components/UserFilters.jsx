import { RotateCcw, Search } from "lucide-react";

export default function UserFilters({ filters, onChange, onReset }) {
  function updateField(field, value) {
    onChange((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <div className="user-filters">
      <label className="user-search">
        <Search size={18} />
        <input
          value={filters.search}
          onChange={(event) => updateField("search", event.target.value)}
          placeholder="Search by name, email or phone"
        />
      </label>

      <select
        value={filters.role}
        onChange={(event) => updateField("role", event.target.value)}
        aria-label="Filter users by role"
      >
        <option value="">All roles</option>
        <option value="customer">Customers</option>
        <option value="collector">Collectors</option>
        <option value="recycling_company">Recycling companies</option>
        <option value="government">Government agencies</option>
        <option value="admin">Administrators</option>
      </select>

      <select
        value={filters.approval_status}
        onChange={(event) =>
          updateField("approval_status", event.target.value)
        }
        aria-label="Filter users by approval status"
      >
        <option value="">All approvals</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <button type="button" className="filter-reset-btn" onClick={onReset}>
        <RotateCcw size={16} />
        Reset
      </button>
    </div>
  );
}
