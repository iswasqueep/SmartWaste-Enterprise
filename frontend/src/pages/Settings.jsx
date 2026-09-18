import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import api from "../api";
import "../styles/settings.css";

const defaultSettings = {
  organization: {
    organization_name: "SmartWaste",
    support_email: "",
    support_phone: "",
    address: "",
    timezone: "Africa/Lagos",
    currency: "NGN",
  },
  operations: {
    default_pickup_fee: 0,
    minimum_pickup_weight_kg: 1,
    maximum_pickup_weight_kg: 10000,
    assignment_timeout_minutes: 30,
    auto_assign_collectors: false,
    allow_same_day_pickup: true,
  },
  notifications: {
    email_notifications: true,
    sms_notifications: false,
    notify_admin_new_user: true,
    notify_admin_new_pickup: true,
    notify_customer_assignment: true,
    notify_collector_assignment: true,
  },
  security: {
    session_timeout_minutes: 60,
    require_strong_passwords: true,
    require_admin_2fa: false,
    lock_account_after_attempts: 5,
    audit_logging_enabled: true,
  },
  appearance: {
    brand_name: "SmartWaste",
    dashboard_compact_mode: false,
    show_welcome_banner: true,
  },
};

const sections = [
  {
    id: "organization",
    label: "Organization",
    icon: Building2,
  },
  {
    id: "operations",
    label: "Operations",
    icon: SlidersHorizontal,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
  },
];

function mergeSettings(data = {}) {
  return Object.fromEntries(
    Object.entries(defaultSettings).map(
      ([section, values]) => [
        section,
        {
          ...values,
          ...(data[section] || {}),
        },
      ],
    ),
  );
}

function getErrorMessage(error, fallback) {
  if (!error.response) {
    return "Unable to connect to the backend server.";
  }

  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    fallback
  );
}

export default function Settings() {
  const [activeSection, setActiveSection] =
    useState("organization");
  const [settings, setSettings] = useState(
    defaultSettings,
  );
  const [savedSettings, setSavedSettings] = useState(
    defaultSettings,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/settings");
      const merged = mergeSettings(
        response.data?.settings || response.data || {},
      );

      setSettings(merged);
      setSavedSettings(merged);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to load system settings.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(settings) !==
      JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  function updateValue(section, field, value) {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));

    setMessage("");
  }

  function handleInput(section, event) {
    const { name, value, type, checked } =
      event.target;

    let nextValue =
      type === "checkbox" ? checked : value;

    if (type === "number") {
      nextValue =
        value === "" ? "" : Number(value);
    }

    updateValue(section, name, nextValue);
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await api.patch(
        "/admin/settings",
        {
          settings,
        },
      );

      const merged = mergeSettings(
        response.data?.settings || settings,
      );

      setSettings(merged);
      setSavedSettings(merged);
      setMessage("Settings saved successfully.");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to save system settings.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setSettings(savedSettings);
    setMessage("");
    setError("");
  }

  return (
    <section className="settings-page">
      <header className="settings-heading">
        <div>
          <span className="settings-kicker">
            <SlidersHorizontal size={17} />
            Administration
          </span>

          <h1>System Settings</h1>

          <p>
            Configure SmartWaste operations,
            notifications, security and branding.
          </p>
        </div>

        <div className="settings-heading-actions">
          <button
            type="button"
            className="settings-secondary-btn"
            onClick={loadSettings}
            disabled={loading || saving}
          >
            <RefreshCw
              size={17}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="settings-primary-btn"
            onClick={saveSettings}
            disabled={
              loading || saving || !hasChanges
            }
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </header>

      {message && (
        <div className="settings-feedback success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="settings-feedback error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="settings-layout">
        <aside className="settings-navigation">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <button
                key={section.id}
                type="button"
                className={
                  activeSection === section.id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveSection(section.id)
                }
              >
                <Icon size={18} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="settings-panel">
          {loading ? (
            <div className="settings-loading">
              Loading system settings...
            </div>
          ) : (
            <>
              {activeSection === "organization" && (
                <div className="settings-section">
                  <div className="settings-section-heading">
                    <Building2 size={22} />
                    <div>
                      <h2>Organization</h2>
                      <p>
                        General organization and regional
                        information.
                      </p>
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <label>
                      Organization name
                      <input
                        name="organization_name"
                        value={
                          settings.organization
                            .organization_name
                        }
                        onChange={(event) =>
                          handleInput(
                            "organization",
                            event,
                          )
                        }
                      />
                    </label>

                    <label>
                      Support email
                      <input
                        type="email"
                        name="support_email"
                        value={
                          settings.organization
                            .support_email
                        }
                        onChange={(event) =>
                          handleInput(
                            "organization",
                            event,
                          )
                        }
                        placeholder="support@smartwaste.ng"
                      />
                    </label>

                    <label>
                      Support phone
                      <input
                        name="support_phone"
                        value={
                          settings.organization
                            .support_phone
                        }
                        onChange={(event) =>
                          handleInput(
                            "organization",
                            event,
                          )
                        }
                        placeholder="+234..."
                      />
                    </label>

                    <label>
                      Timezone
                      <select
                        name="timezone"
                        value={
                          settings.organization.timezone
                        }
                        onChange={(event) =>
                          handleInput(
                            "organization",
                            event,
                          )
                        }
                      >
                        <option value="Africa/Lagos">
                          Africa/Lagos
                        </option>
                        <option value="UTC">UTC</option>
                      </select>
                    </label>

                    <label>
                      Currency
                      <select
                        name="currency"
                        value={
                          settings.organization.currency
                        }
                        onChange={(event) =>
                          handleInput(
                            "organization",
                            event,
                          )
                        }
                      >
                        <option value="NGN">
                          Nigerian Naira (NGN)
                        </option>
                        <option value="USD">
                          US Dollar (USD)
                        </option>
                      </select>
                    </label>

                    <label className="settings-full">
                      Address
                      <textarea
                        name="address"
                        value={
                          settings.organization.address
                        }
                        onChange={(event) =>
                          handleInput(
                            "organization",
                            event,
                          )
                        }
                        rows="3"
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeSection === "operations" && (
                <div className="settings-section">
                  <div className="settings-section-heading">
                    <SlidersHorizontal size={22} />
                    <div>
                      <h2>Operations</h2>
                      <p>
                        Pickup, assignment and weight
                        configuration.
                      </p>
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <label>
                      Default pickup fee
                      <input
                        type="number"
                        min="0"
                        name="default_pickup_fee"
                        value={
                          settings.operations
                            .default_pickup_fee
                        }
                        onChange={(event) =>
                          handleInput(
                            "operations",
                            event,
                          )
                        }
                      />
                    </label>

                    <label>
                      Assignment timeout (minutes)
                      <input
                        type="number"
                        min="1"
                        name="assignment_timeout_minutes"
                        value={
                          settings.operations
                            .assignment_timeout_minutes
                        }
                        onChange={(event) =>
                          handleInput(
                            "operations",
                            event,
                          )
                        }
                      />
                    </label>

                    <label>
                      Minimum pickup weight (kg)
                      <input
                        type="number"
                        min="0"
                        name="minimum_pickup_weight_kg"
                        value={
                          settings.operations
                            .minimum_pickup_weight_kg
                        }
                        onChange={(event) =>
                          handleInput(
                            "operations",
                            event,
                          )
                        }
                      />
                    </label>

                    <label>
                      Maximum pickup weight (kg)
                      <input
                        type="number"
                        min="1"
                        name="maximum_pickup_weight_kg"
                        value={
                          settings.operations
                            .maximum_pickup_weight_kg
                        }
                        onChange={(event) =>
                          handleInput(
                            "operations",
                            event,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="settings-toggle-list">
                    <ToggleRow
                      title="Automatic collector assignment"
                      description="Automatically assign available collectors and vehicles."
                      checked={
                        settings.operations
                          .auto_assign_collectors
                      }
                      onChange={(checked) =>
                        updateValue(
                          "operations",
                          "auto_assign_collectors",
                          checked,
                        )
                      }
                    />

                    <ToggleRow
                      title="Allow same-day pickup"
                      description="Customers can request pickup for the current day."
                      checked={
                        settings.operations
                          .allow_same_day_pickup
                      }
                      onChange={(checked) =>
                        updateValue(
                          "operations",
                          "allow_same_day_pickup",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {activeSection === "notifications" && (
                <div className="settings-section">
                  <div className="settings-section-heading">
                    <Bell size={22} />
                    <div>
                      <h2>Notifications</h2>
                      <p>
                        Select which platform alerts are
                        enabled.
                      </p>
                    </div>
                  </div>

                  <div className="settings-toggle-list">
                    {[
                      [
                        "email_notifications",
                        "Email notifications",
                        "Send operational alerts by email.",
                      ],
                      [
                        "sms_notifications",
                        "SMS notifications",
                        "Send selected alerts by SMS.",
                      ],
                      [
                        "notify_admin_new_user",
                        "New user registration",
                        "Notify administrators when a user registers.",
                      ],
                      [
                        "notify_admin_new_pickup",
                        "New pickup request",
                        "Notify administrators when a pickup is submitted.",
                      ],
                      [
                        "notify_customer_assignment",
                        "Customer assignment alert",
                        "Tell customers when a collector is assigned.",
                      ],
                      [
                        "notify_collector_assignment",
                        "Collector assignment alert",
                        "Tell collectors when a job is assigned.",
                      ],
                    ].map(([key, title, description]) => (
                      <ToggleRow
                        key={key}
                        title={title}
                        description={description}
                        checked={
                          settings.notifications[key]
                        }
                        onChange={(checked) =>
                          updateValue(
                            "notifications",
                            key,
                            checked,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeSection === "security" && (
                <div className="settings-section">
                  <div className="settings-section-heading">
                    <ShieldCheck size={22} />
                    <div>
                      <h2>Security</h2>
                      <p>
                        Authentication and account
                        protection settings.
                      </p>
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <label>
                      Session timeout (minutes)
                      <input
                        type="number"
                        min="5"
                        name="session_timeout_minutes"
                        value={
                          settings.security
                            .session_timeout_minutes
                        }
                        onChange={(event) =>
                          handleInput(
                            "security",
                            event,
                          )
                        }
                      />
                    </label>

                    <label>
                      Account lock attempts
                      <input
                        type="number"
                        min="1"
                        name="lock_account_after_attempts"
                        value={
                          settings.security
                            .lock_account_after_attempts
                        }
                        onChange={(event) =>
                          handleInput(
                            "security",
                            event,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="settings-toggle-list">
                    <ToggleRow
                      title="Strong password policy"
                      description="Require stronger passwords for all users."
                      checked={
                        settings.security
                          .require_strong_passwords
                      }
                      onChange={(checked) =>
                        updateValue(
                          "security",
                          "require_strong_passwords",
                          checked,
                        )
                      }
                    />

                    <ToggleRow
                      title="Require administrator 2FA"
                      description="Require two-factor authentication for administrators."
                      checked={
                        settings.security
                          .require_admin_2fa
                      }
                      onChange={(checked) =>
                        updateValue(
                          "security",
                          "require_admin_2fa",
                          checked,
                        )
                      }
                    />

                    <ToggleRow
                      title="Audit logging"
                      description="Record important administrative and security activities."
                      checked={
                        settings.security
                          .audit_logging_enabled
                      }
                      onChange={(checked) =>
                        updateValue(
                          "security",
                          "audit_logging_enabled",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {activeSection === "appearance" && (
                <div className="settings-section">
                  <div className="settings-section-heading">
                    <Palette size={22} />
                    <div>
                      <h2>Appearance</h2>
                      <p>
                        Configure dashboard branding and
                        display preferences.
                      </p>
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <label>
                      Dashboard brand name
                      <input
                        name="brand_name"
                        value={
                          settings.appearance.brand_name
                        }
                        onChange={(event) =>
                          handleInput(
                            "appearance",
                            event,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="settings-toggle-list">
                    <ToggleRow
                      title="Compact dashboard mode"
                      description="Reduce spacing to display more data."
                      checked={
                        settings.appearance
                          .dashboard_compact_mode
                      }
                      onChange={(checked) =>
                        updateValue(
                          "appearance",
                          "dashboard_compact_mode",
                          checked,
                        )
                      }
                    />

                    <ToggleRow
                      title="Show welcome banner"
                      description="Display the welcome section on the admin dashboard."
                      checked={
                        settings.appearance
                          .show_welcome_banner
                      }
                      onChange={(checked) =>
                        updateValue(
                          "appearance",
                          "show_welcome_banner",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              )}

              <footer className="settings-footer">
                <div>
                  <Clock3 size={16} />
                  <span>
                    {hasChanges
                      ? "You have unsaved changes."
                      : "All changes are saved."}
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={discardChanges}
                    disabled={!hasChanges || saving}
                  >
                    Discard
                  </button>

                  <button
                    type="button"
                    className="settings-primary-btn"
                    onClick={saveSettings}
                    disabled={!hasChanges || saving}
                  >
                    <Save size={17} />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <label className="settings-toggle-row">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />

      <span className="settings-switch" />
    </label>
  );
}
