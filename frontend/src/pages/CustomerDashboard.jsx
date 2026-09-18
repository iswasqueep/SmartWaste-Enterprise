import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  MapPin,
  PackageCheck,
  Plus,
  ReceiptText,
  Recycle,
  Truck,
  WalletCards,
  ChevronRight,
} from "lucide-react";

import api from "../api";
import "../styles/customer-dashboard.css";

const money = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const day = (value) =>
  value
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00`))
    : "Not scheduled";

const label = (value) =>
  String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );

function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function StatCard({
  title,
  value,
  caption,
  icon: Icon,
  tone,
}) {
  return (
    <article className={`customer-stat tone-${tone}`}>
      <span className="customer-stat__icon">
        <Icon size={21} />
      </span>

      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <p>{caption}</p>
      </div>
    </article>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  action,
  onClick,
}) {
  return (
    <div className="customer-empty">
      <span>
        <Icon size={26} />
      </span>

      <h3>{title}</h3>
      <p>{text}</p>

      {action && (
        <button
          type="button"
          onClick={onClick}
        >
          {action}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export default function CustomerDashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        "/customer/dashboard"
      );

      setData(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Unable to load your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function openPickupList(pickupId = null) {
    if (pickupId) {
      navigate(
        `/my-pickups?pickup=${encodeURIComponent(
          pickupId
        )}`
      );
      return;
    }

    navigate("/my-pickups");
  }

  if (loading) {
    return (
      <main className="customer-dashboard">
        <div className="customer-loading">
          Loading your dashboard…
        </div>
      </main>
    );
  }

  const summary = data?.summary || {};
  const customer = data?.customer || {};
  const pickup = data?.upcoming_pickup;
  const recent = Array.isArray(
    data?.recent_pickups
  )
    ? data.recent_pickups
    : [];
  const notifications = Array.isArray(
    data?.notifications
  )
    ? data.notifications
    : [];

  const points = Number(
    summary.reward_points || 0
  );
  const target = Number(
    data?.reward_target || 500
  );
  const progress = Math.min(
    100,
    target ? (points / target) * 100 : 0
  );

  const actions = [
    [
      "Request pickup",
      "Schedule a collection",
      Plus,
      "/pickup-request",
    ],
    [
      "Track pickup",
      "Follow an active request",
      Truck,
      "/my-pickups",
    ],
    [
      "Pay invoice",
      "Settle outstanding bills",
      CreditCard,
      "/payments",
    ],
    [
      "Report issue",
      "Submit a complaint",
      AlertCircle,
      "/complaints",
    ],
  ];

  return (
    <main className="customer-dashboard">
      <section className="customer-hero">
        <div>
          <small>{greeting()}</small>

          <h1>
            Welcome back
            {customer.full_name
              ? `, ${
                  customer.full_name.split(" ")[0]
                }`
              : ""}
          </h1>

          <p>
            Schedule, monitor and pay for waste
            collections from one place.
          </p>
        </div>

        <span className="customer-hero__icon">
          <Recycle size={54} />
        </span>
      </section>

      {error && (
        <div className="customer-error">
          <AlertCircle size={19} />
          <span>{error}</span>

          <button
            type="button"
            onClick={loadDashboard}
          >
            Retry
          </button>
        </div>
      )}

      <section className="customer-stats">
        <StatCard
          title="Active pickups"
          value={summary.active_pickups || 0}
          caption="Pending or in progress"
          icon={Clock3}
          tone="amber"
        />

        <StatCard
          title="Completed pickups"
          value={summary.completed_pickups || 0}
          caption="Successfully collected"
          icon={PackageCheck}
          tone="green"
        />

        <StatCard
          title="Outstanding invoices"
          value={money(
            summary.outstanding_balance
          )}
          caption={`${
            summary.pending_invoices || 0
          } invoice(s) pending`}
          icon={ReceiptText}
          tone="blue"
        />

        <StatCard
          title="Reward points"
          value={`${points} pts`}
          caption="Earned from recycling"
          icon={Gift}
          tone="purple"
        />
      </section>

      <section className="customer-panel">
        <header>
          <div>
            <small>Get things done</small>
            <h2>Quick actions</h2>
          </div>
        </header>

        <div className="customer-actions">
          {actions.map(
            ([title, text, Icon, path]) => (
              <button
                key={title}
                type="button"
                onClick={() => navigate(path)}
              >
                <span>
                  <Icon size={20} />
                </span>

                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>

                <ChevronRight size={18} />
              </button>
            )
          )}
        </div>
      </section>

      <div className="customer-grid">
        <section className="customer-panel">
          <header>
            <div>
              <small>Next collection</small>
              <h2>Upcoming pickup</h2>
            </div>

            <button
              type="button"
              onClick={() => openPickupList()}
            >
              View all
            </button>
          </header>

          {pickup ? (
            <div className="pickup-card">
              <div className="pickup-card__top">
                <div>
                  <small>{pickup.reference}</small>

                  <h3>
                    {pickup.waste_category?.name ||
                      "Waste collection"}
                  </h3>
                </div>

                <span
                  className={`status status--${
                    pickup.status || "pending"
                  }`}
                >
                  {label(pickup.status)}
                </span>
              </div>

              <div className="pickup-details">
                <div>
                  <CalendarDays size={18} />

                  <span>
                    <small>Pickup date</small>
                    <strong>
                      {day(pickup.pickup_date)}
                    </strong>
                  </span>
                </div>

                <div>
                  <Clock3 size={18} />

                  <span>
                    <small>Preferred time</small>
                    <strong>
                      {pickup.preferred_time ||
                        "Not specified"}
                    </strong>
                  </span>
                </div>

                <div>
                  <MapPin size={18} />

                  <span>
                    <small>Address</small>
                    <strong>
                      {[
                        pickup.address?.street,
                        pickup.address?.city,
                        pickup.address?.state,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                        "Saved address"}
                    </strong>
                  </span>
                </div>

                <div>
                  <Truck size={18} />

                  <span>
                    <small>Collector</small>
                    <strong>
                      {pickup.collector?.full_name ||
                        "Waiting for assignment"}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  openPickupList(pickup.id)
                }
              >
                Track pickup
                <ChevronRight size={17} />
              </button>
            </div>
          ) : (
            <Empty
              icon={Truck}
              title="No upcoming pickup"
              text="Schedule a collection and it will appear here."
              action="Request pickup"
              onClick={() =>
                navigate("/pickup-request")
              }
            />
          )}
        </section>

        <section className="customer-panel">
          <header>
            <div>
              <small>Your contribution</small>
              <h2>Reward progress</h2>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/rewards")
              }
            >
              Details
            </button>
          </header>

          <div className="reward-card">
            <div className="reward-score">
              <span>
                <Gift size={27} />
              </span>

              <div>
                <strong>{points}</strong>
                <small>
                  of {target} points
                </small>
              </div>
            </div>

            <div className="progress">
              <span
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p>
              {Math.max(0, target - points)}{" "}
              more points to your next
              milestone.
            </p>

            <div className="impact">
              <div>
                <Recycle size={19} />

                <span>
                  <strong>
                    {summary.recycled_weight_kg ||
                      0}{" "}
                    kg
                  </strong>
                  <small>Recycled waste</small>
                </span>
              </div>

              <div>
                <WalletCards size={19} />

                <span>
                  <strong>
                    {money(summary.total_paid)}
                  </strong>
                  <small>Total payments</small>
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="customer-grid customer-grid--lower">
        <section className="customer-panel">
          <header>
            <div>
              <small>Collection history</small>
              <h2>Recent pickups</h2>
            </div>

            <button
              type="button"
              onClick={() => openPickupList()}
            >
              View all
            </button>
          </header>

          {recent.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recent.map((item) => (
                    <tr
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        openPickupList(item.id)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          openPickupList(item.id);
                        }
                      }}
                    >
                      <td>
                        <strong>
                          {item.reference}
                        </strong>
                      </td>

                      <td>
                        {item.waste_category?.name ||
                          "Not specified"}
                      </td>

                      <td>
                        {day(item.pickup_date)}
                      </td>

                      <td>
                        {item.actual_weight ??
                          item.estimated_weight ??
                          0}{" "}
                        kg
                      </td>

                      <td>
                        <span
                          className={`status status--${
                            item.status ||
                            "pending"
                          }`}
                        >
                          {label(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={PackageCheck}
              title="No pickup history yet"
              text="Your requests will appear here."
              action="Request pickup"
              onClick={() =>
                navigate("/pickup-request")
              }
            />
          )}
        </section>

        <section className="customer-panel">
          <header>
            <div>
              <small>Latest updates</small>
              <h2>Notifications</h2>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/notifications")
              }
            >
              View all
            </button>
          </header>

          {notifications.length ? (
            <div className="notification-list">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  className={
                    item.read_status
                      ? ""
                      : "unread"
                  }
                >
                  <span>
                    {item.read_status ? (
                      <CheckCircle2
                        size={18}
                      />
                    ) : (
                      <Bell size={18} />
                    )}
                  </span>

                  <div>
                    <strong>
                      {item.title}
                    </strong>

                    <p>{item.message}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={Bell}
              title="You are all caught up"
              text="New updates will appear here."
            />
          )}
        </section>
      </div>
    </main>
  );
}