import { useEffect, useState } from "react";
import {
  Check,
  Edit3,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import api from "../../api";
import "../../styles/customer-pages.css";
import "../../styles/customer-addresses.css";

const initialProfile = {
  full_name: "",
  email: "",
  phone: "",
};

const initialAddress = {
  label: "Home",
  street: "",
  city: "",
  state: "",
  latitude: "",
  longitude: "",
  is_default: false,
};

export default function CustomerProfile() {
  const [profile, setProfile] = useState(initialProfile);
  const [addresses, setAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState(initialAddress);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const profileResponse = await api.get("/profile");

      const profileData =
        profileResponse.data?.user ||
        profileResponse.data ||
        initialProfile;

      setProfile({
        full_name: profileData.full_name || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to load profile."
      );
    }

    try {
      await loadAddresses();
    } finally {
      setLoading(false);
    }
  }

  async function loadAddresses() {
    try {
      const response = await api.get("/profile/addresses");

      const data =
        response.data?.addresses ??
        response.data ??
        [];

      setAddresses(
        Array.isArray(data) ? data : []
      );
    } catch (requestError) {
      setAddresses([]);

      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to load saved addresses."
      );
    }
  }

  function clearMessages() {
    setError("");
    setMessage("");
  }

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));

    clearMessages();
  }

  function handleAddressChange(event) {
    const { name, value, type, checked } = event.target;

    setAddressForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    clearMessages();
  }

  async function saveProfile(event) {
    event.preventDefault();
    clearMessages();

    const fullName = profile.full_name.trim();

    if (fullName.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await api.patch("/profile", {
        full_name: fullName,
        phone: profile.phone.trim(),
      });

      const updatedUser =
        response.data?.user || {};

      setProfile((current) => ({
        ...current,
        ...updatedUser,
        full_name: updatedUser.full_name || fullName,
        phone: updatedUser.phone ?? profile.phone.trim(),
      }));

      const storedUser = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...storedUser,
          ...updatedUser,
        })
      );

      setMessage(
        response.data?.message ||
          "Profile updated successfully."
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to update profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function openNewAddressForm() {
    clearMessages();
    setEditingAddressId(null);
    setAddressForm({
      ...initialAddress,
      is_default: addresses.length === 0,
    });
    setShowAddressForm(true);
  }

  function openEditAddressForm(address) {
    clearMessages();
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label || "Home",
      street: address.street || "",
      city: address.city || "",
      state: address.state || "",
      latitude: address.latitude ?? "",
      longitude: address.longitude ?? "",
      is_default: Boolean(address.is_default),
    });
    setShowAddressForm(true);
  }

  function closeAddressForm() {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressForm(initialAddress);
  }

  async function saveAddress(event) {
    event.preventDefault();
    clearMessages();

    if (!addressForm.street.trim()) {
      setError("Street address is required.");
      return;
    }

    if (!addressForm.city.trim()) {
      setError("City is required.");
      return;
    }

    if (!addressForm.state.trim()) {
      setError("State is required.");
      return;
    }

    setSavingAddress(true);

    const payload = {
      label: addressForm.label.trim() || "Home",
      street: addressForm.street.trim(),
      city: addressForm.city.trim(),
      state: addressForm.state.trim(),
      latitude:
        addressForm.latitude === ""
          ? null
          : Number(addressForm.latitude),
      longitude:
        addressForm.longitude === ""
          ? null
          : Number(addressForm.longitude),
      is_default: addressForm.is_default,
    };

    try {
      const response = editingAddressId
        ? await api.patch(
            `/profile/addresses/${editingAddressId}`,
            payload
          )
        : await api.post(
            "/profile/addresses",
            payload
          );

      setMessage(
        response.data?.message ||
          (editingAddressId
            ? "Address updated successfully."
            : "Address added successfully.")
      );

      closeAddressForm();
      await loadAddresses();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to save address."
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function setDefaultAddress(addressId) {
    clearMessages();
    setBusyAddressId(addressId);

    try {
      const response = await api.patch(
        `/profile/addresses/${addressId}/default`
      );

      setMessage(
        response.data?.message ||
          "Default address updated."
      );

      await loadAddresses();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to set default address."
      );
    } finally {
      setBusyAddressId(null);
    }
  }

  async function deleteAddress(address) {
    const confirmed = window.confirm(
      `Delete "${address.label || "Address"}"?`
    );

    if (!confirmed) {
      return;
    }

    clearMessages();
    setBusyAddressId(address.id);

    try {
      const response = await api.delete(
        `/profile/addresses/${address.id}`
      );

      setMessage(
        response.data?.message ||
          "Address deleted successfully."
      );

      await loadAddresses();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to delete address."
      );
    } finally {
      setBusyAddressId(null);
    }
  }

  if (loading) {
    return (
      <main className="customer-page customer-profile-page">
        <section className="customer-profile-card">
          <div className="customer-profile-loading">
            Loading your profile...
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="customer-page customer-profile-page">
      <header className="customer-profile-header">
        <span>ACCOUNT</span>
        <h1>Profile</h1>
        <p>
          Manage your personal information and saved pickup addresses.
        </p>
      </header>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}

      <div className="customer-profile-layout">
        <form
          className="customer-profile-card customer-profile-form"
          onSubmit={saveProfile}
        >
          <h2>Personal information</h2>

          <label>
            Full name
            <input
              type="text"
              name="full_name"
              value={profile.full_name}
              onChange={handleProfileChange}
              maxLength={120}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={profile.email}
              disabled
              readOnly
            />
          </label>

          <label>
            Phone
            <input
              type="tel"
              name="phone"
              value={profile.phone}
              onChange={handleProfileChange}
              maxLength={30}
            />
          </label>

          <div className="actions">
            <button
              type="submit"
              className="primary"
              disabled={savingProfile}
            >
              <Save size={17} />
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>

        <section className="customer-profile-card customer-address-panel">
          <div className="customer-address-heading">
            <div>
              <h2>Saved addresses</h2>
              <p>
                These addresses are available on the New Pickup page.
              </p>
            </div>

            <button
              type="button"
              className="primary"
              onClick={openNewAddressForm}
            >
              <Plus size={17} />
              Add address
            </button>
          </div>

          {showAddressForm && (
            <form
              className="customer-address-form"
              onSubmit={saveAddress}
            >
              <div className="customer-address-form-header">
                <h3>
                  {editingAddressId
                    ? "Edit address"
                    : "Add address"}
                </h3>

                <button
                  type="button"
                  className="customer-icon-button"
                  onClick={closeAddressForm}
                  aria-label="Close address form"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="customer-address-form-grid">
                <label>
                  Label
                  <input
                    type="text"
                    name="label"
                    value={addressForm.label}
                    onChange={handleAddressChange}
                    placeholder="Home, Office..."
                    maxLength={50}
                  />
                </label>

                <label className="customer-address-wide">
                  Street address
                  <input
                    type="text"
                    name="street"
                    value={addressForm.street}
                    onChange={handleAddressChange}
                    placeholder="House number and street"
                    maxLength={255}
                    required
                  />
                </label>

                <label>
                  City
                  <input
                    type="text"
                    name="city"
                    value={addressForm.city}
                    onChange={handleAddressChange}
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  State
                  <input
                    type="text"
                    name="state"
                    value={addressForm.state}
                    onChange={handleAddressChange}
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  Latitude (optional)
                  <input
                    type="number"
                    name="latitude"
                    value={addressForm.latitude}
                    onChange={handleAddressChange}
                    min="-90"
                    max="90"
                    step="any"
                  />
                </label>

                <label>
                  Longitude (optional)
                  <input
                    type="number"
                    name="longitude"
                    value={addressForm.longitude}
                    onChange={handleAddressChange}
                    min="-180"
                    max="180"
                    step="any"
                  />
                </label>

                <label className="customer-address-checkbox customer-address-wide">
                  <input
                    type="checkbox"
                    name="is_default"
                    checked={addressForm.is_default}
                    onChange={handleAddressChange}
                  />
                  Use as my default pickup address
                </label>
              </div>

              <div className="customer-address-form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeAddressForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={savingAddress}
                >
                  <Save size={17} />
                  {savingAddress
                    ? "Saving..."
                    : editingAddressId
                      ? "Update address"
                      : "Add address"}
                </button>
              </div>
            </form>
          )}

          <div className="customer-address-list">
            {addresses.length === 0 ? (
              <div className="customer-address-empty">
                <MapPin size={30} />
                <h3>No saved addresses</h3>
                <p>
                  Add your first pickup address to enable the New Pickup form.
                </p>
              </div>
            ) : (
              addresses.map((address) => (
                <article
                  className="customer-address-card"
                  key={address.id}
                >
                  <div className="customer-address-icon">
                    <MapPin size={20} />
                  </div>

                  <div className="customer-address-content">
                    <div className="customer-address-title">
                      <strong>
                        {address.label || "Address"}
                      </strong>

                      {address.is_default && (
                        <span>
                          <Check size={14} />
                          Default
                        </span>
                      )}
                    </div>

                    <p>{address.street}</p>
                    <small>
                      {[address.city, address.state]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  </div>

                  <div className="customer-address-actions">
                    {!address.is_default && (
                      <button
                        type="button"
                        onClick={() =>
                          setDefaultAddress(address.id)
                        }
                        disabled={busyAddressId === address.id}
                      >
                        Set default
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        openEditAddressForm(address)
                      }
                      aria-label="Edit address"
                    >
                      <Edit3 size={17} />
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        deleteAddress(address)
                      }
                      disabled={busyAddressId === address.id}
                      aria-label="Delete address"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}