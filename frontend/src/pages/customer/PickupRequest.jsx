import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  PackagePlus,
  Scale,
} from "lucide-react";

import api from "../../api";
import "../../styles/pickup-request.css";

const initialForm = {
  address_id: "",
  waste_category_id: "",
  pickup_date: "",
  preferred_time: "",
  estimated_weight: "",
  notes: "",
};

export default function PickupRequest() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [addresses, setAddresses] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loadingAddresses, setLoadingAddresses] =
    useState(true);

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [addressError, setAddressError] =
    useState("");

  const [categoryError, setCategoryError] =
    useState("");

  const [submitError, setSubmitError] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    loadAddresses();
    loadCategories();
  }, []);

  async function loadAddresses() {
    setLoadingAddresses(true);
    setAddressError("");

    try {
      const response = await api.get(
        "/profile/addresses"
      );

      const addressData =
        response.data?.addresses ??
        response.data ??
        [];

      setAddresses(
        Array.isArray(addressData)
          ? addressData
          : []
      );
    } catch (requestError) {
      console.error(
        "Address request failed:",
        requestError.response?.status,
        requestError.response?.data
      );

      setAddressError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          `Unable to load addresses${
            requestError.response?.status
              ? ` (${requestError.response.status})`
              : ""
          }.`
      );

      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  }

  async function loadCategories() {
    setLoadingCategories(true);
    setCategoryError("");

    try {
      const response = await api.get(
        "/public/waste-categories"
      );

      const categoryData =
        response.data?.categories ??
        response.data ??
        [];

      setCategories(
        Array.isArray(categoryData)
          ? categoryData
          : []
      );
    } catch (requestError) {
      console.error(
        "Waste category request failed:",
        requestError.response?.status,
        requestError.response?.data
      );

      setCategoryError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          `Unable to load waste categories${
            requestError.response?.status
              ? ` (${requestError.response.status})`
              : ""
          }.`
      );

      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setSubmitError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitError("");
    setMessage("");

    if (!form.address_id) {
      setSubmitError(
        "Please select a pickup address."
      );
      return;
    }

    if (!form.waste_category_id) {
      setSubmitError(
        "Please select a waste category."
      );
      return;
    }

    if (!form.pickup_date) {
      setSubmitError(
        "Please select a pickup date."
      );
      return;
    }

    if (!form.preferred_time) {
      setSubmitError(
        "Please select a preferred time."
      );
      return;
    }

    const estimatedWeight = Number(
      form.estimated_weight
    );

    if (
      !Number.isFinite(estimatedWeight) ||
      estimatedWeight <= 0
    ) {
      setSubmitError(
        "Estimated weight must be greater than zero."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post(
        "/pickups",
        {
          address_id: Number(
            form.address_id
          ),
          waste_category_id: Number(
            form.waste_category_id
          ),
          pickup_date:
            form.pickup_date,
          preferred_time:
            form.preferred_time,
          estimated_weight:
            estimatedWeight,
          notes: form.notes.trim(),
        }
      );

      setMessage(
        response.data?.message ||
          "Pickup request created successfully."
      );

      setForm(initialForm);

      window.setTimeout(() => {
        navigate("/my-pickups");
      }, 1200);
    } catch (requestError) {
      console.error(
        "Pickup submission failed:",
        requestError.response?.status,
        requestError.response?.data
      );

      setSubmitError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to create pickup request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const minimumDate =
    new Date().toISOString().split("T")[0];

  return (
    <main className="pickup-request-page">
      <section className="pickup-request-header">
        <span className="pickup-request-eyebrow">
          New collection
        </span>

        <h1>Request a pickup</h1>

        <p>
          Schedule a waste collection from one
          of your saved addresses.
        </p>
      </section>

      {addressError && (
        <div className="pickup-alert pickup-alert-error">
          {addressError}
        </div>
      )}

      {categoryError && (
        <div className="pickup-alert pickup-alert-error">
          {categoryError}
        </div>
      )}

      {submitError && (
        <div className="pickup-alert pickup-alert-error">
          {submitError}
        </div>
      )}

      {message && (
        <div className="pickup-alert pickup-alert-success">
          {message}
        </div>
      )}

      <form
        className="pickup-request-card"
        onSubmit={handleSubmit}
      >
        <div className="pickup-form-grid">
          <label className="pickup-field">
            <span>
              <MapPin size={17} />
              Pickup address
            </span>

            <select
              name="address_id"
              value={form.address_id}
              onChange={handleChange}
              disabled={loadingAddresses}
              required
            >
              <option value="">
                {loadingAddresses
                  ? "Loading addresses..."
                  : addresses.length === 0
                    ? "No saved addresses available"
                    : "Select address"}
              </option>

              {addresses.map(
                (address) => (
                  <option
                    key={address.id}
                    value={address.id}
                  >
                    {[
                      address.label,
                      address.street,
                      address.city,
                      address.state,
                    ]
                      .filter(Boolean)
                      .join(" — ")}
                  </option>
                )
              )}
            </select>

            {!loadingAddresses &&
              addresses.length === 0 &&
              !addressError && (
                <small className="pickup-field-help">
                  Add a saved address before
                  requesting a pickup.
                </small>
              )}
          </label>

          <label className="pickup-field">
            <span>
              <PackagePlus size={17} />
              Waste category
            </span>

            <select
              name="waste_category_id"
              value={
                form.waste_category_id
              }
              onChange={handleChange}
              disabled={loadingCategories}
              required
            >
              <option value="">
                {loadingCategories
                  ? "Loading categories..."
                  : categories.length === 0
                    ? "No categories available"
                    : "Select category"}
              </option>

              {categories
                .filter(
                  (category) =>
                    category.active !==
                    false
                )
                .map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="pickup-field">
            <span>
              <CalendarDays size={17} />
              Pickup date
            </span>

            <input
              type="date"
              name="pickup_date"
              value={form.pickup_date}
              min={minimumDate}
              onChange={handleChange}
              required
            />
          </label>

          <label className="pickup-field">
            <span>Preferred time</span>

            <select
              name="preferred_time"
              value={form.preferred_time}
              onChange={handleChange}
              required
            >
              <option value="">
                Select preferred time
              </option>

              <option value="8:00 AM - 10:00 AM">
                8:00 AM – 10:00 AM
              </option>

              <option value="10:00 AM - 12:00 PM">
                10:00 AM – 12:00 PM
              </option>

              <option value="12:00 PM - 2:00 PM">
                12:00 PM – 2:00 PM
              </option>

              <option value="2:00 PM - 4:00 PM">
                2:00 PM – 4:00 PM
              </option>
            </select>
          </label>

          <label className="pickup-field">
            <span>
              <Scale size={17} />
              Estimated weight
            </span>

            <div className="pickup-weight-input">
              <input
                type="number"
                name="estimated_weight"
                value={
                  form.estimated_weight
                }
                onChange={handleChange}
                min="0.1"
                step="0.1"
                placeholder="Example: 12.5"
                required
              />

              <span>kg</span>
            </div>
          </label>

          <label className="pickup-field pickup-field-wide">
            <span>Notes</span>

            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows="5"
              placeholder="Add landmark details or special collection instructions."
            />
          </label>
        </div>

        <div className="pickup-form-actions">
          <button
            type="button"
            className="pickup-button pickup-button-secondary"
            onClick={() =>
              setForm(initialForm)
            }
            disabled={submitting}
          >
            Clear
          </button>

          <button
            type="submit"
            className="pickup-button pickup-button-primary"
            disabled={
              submitting ||
              loadingAddresses ||
              loadingCategories ||
              addresses.length === 0 ||
              categories.length === 0
            }
          >
            {submitting
              ? "Submitting..."
              : "Request pickup"}
          </button>
        </div>
      </form>
    </main>
  );
}