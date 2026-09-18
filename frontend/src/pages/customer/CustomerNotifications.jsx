import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Gift,
  LoaderCircle,
  MessageSquareWarning,
  PackageCheck,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";
import "../../styles/customer-notifications.css";

const FILTER_OPTIONS = [
  {
    value: "all",
    label: "All notifications",
  },
  {
    value: "unread",
    label: "Unread only",
  },
  {
    value: "pickup",
    label: "Pickup updates",
  },
  {
    value: "payment",
    label: "Payment updates",
  },
  {
    value: "complaint",
    label: "Complaint updates",
  },
  {
    value: "reward",
    label: "Reward updates",
  },
];

function normalizeNotificationsResponse(data) {
  const source =
    data?.data ??
    data ??
    {};

  const notifications =
    source.notifications ??
    source.items ??
    source.results ??
    [];

  return {
    notifications: Array.isArray(
      notifications
    )
      ? notifications
      : [],
    unreadCount: Number(
      source.unread_count ??
        source.unreadCount ??
        notifications.filter(
          (item) =>
            !(
              item.read_status ??
              item.is_read ??
              item.read
            )
        ).length
    ),
  };
}

function getNotificationType(notification) {
  const rawType = String(
    notification.type ??
      notification.notification_type ??
      notification.category ??
      ""
  ).toLowerCase();

  const searchableText = [
    notification.title,
    notification.message,
    notification.body,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    rawType.includes("pickup") ||
    searchableText.includes("pickup") ||
    searchableText.includes("collector")
  ) {
    return "pickup";
  }

  if (
    rawType.includes("payment") ||
    rawType.includes("invoice") ||
    searchableText.includes("payment") ||
    searchableText.includes("invoice")
  ) {
    return "payment";
  }

  if (
    rawType.includes("complaint") ||
    searchableText.includes("complaint") ||
    searchableText.includes("support")
  ) {
    return "complaint";
  }

  if (
    rawType.includes("reward") ||
    searchableText.includes("reward") ||
    searchableText.includes("points")
  ) {
    return "reward";
  }

  return "general";
}

function getNotificationIcon(type) {
  const icons = {
    pickup: PackageCheck,
    payment: CreditCard,
    complaint: MessageSquareWarning,
    reward: Gift,
    general: Bell,
  };

  return icons[type] || Bell;
}

function isNotificationRead(notification) {
  return Boolean(
    notification.read_status ??
      notification.is_read ??
      notification.read
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatRelativeTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const seconds = Math.floor(
    (Date.now() - date.getTime()) / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} hr${
      hours === 1 ? "" : "s"
    } ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days} day${
      days === 1 ? "" : "s"
    } ago`;
  }

  return formatDateTime(value);
}

function CustomerNotifications() {
  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    markingAll,
    setMarkingAll,
  ] = useState(false);

  const [
    activeItemId,
    setActiveItemId,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState("all");

  const loadNotifications = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await api.get(
          "/notifications"
        );

        const normalized =
          normalizeNotificationsResponse(
            response.data
          );

        setNotifications(
          normalized.notifications
        );
      } catch (requestError) {
        console.error(
          "Unable to load notifications:",
          requestError
        );

        setError(
          requestError.response?.data
            ?.error ||
            "Unable to load notifications."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !isNotificationRead(
            notification
          )
      ).length,
    [notifications]
  );

  const readCount =
    notifications.length -
    unreadCount;

  const filteredNotifications =
    useMemo(() => {
      const searchValue =
        searchTerm
          .trim()
          .toLowerCase();

      return notifications.filter(
        (notification) => {
          const notificationType =
            getNotificationType(
              notification
            );

          const read =
            isNotificationRead(
              notification
            );

          const matchesFilter =
            filter === "all" ||
            (filter === "unread" &&
              !read) ||
            notificationType ===
              filter;

          const searchableContent = [
            notification.title,
            notification.message,
            notification.body,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !searchValue ||
            searchableContent.includes(
              searchValue
            );

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );
    }, [
      notifications,
      searchTerm,
      filter,
    ]);

  async function markAsRead(
    notification
  ) {
    if (
      isNotificationRead(
        notification
      )
    ) {
      return;
    }

    setActiveItemId(
      notification.id
    );
    setError("");

    try {
      await api.patch(
        `/notifications/${notification.id}/read`
      );

      setNotifications(
        (current) =>
          current.map((item) =>
            item.id ===
            notification.id
              ? {
                  ...item,
                  read_status: true,
                  is_read: true,
                  read: true,
                }
              : item
          )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.error ||
          "Unable to mark notification as read."
      );
    } finally {
      setActiveItemId(null);
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) {
      return;
    }

    setMarkingAll(true);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        "/notifications/read-all"
      );

      setNotifications(
        (current) =>
          current.map((item) => ({
            ...item,
            read_status: true,
            is_read: true,
            read: true,
          }))
      );

      setSuccess(
        "All notifications marked as read."
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.error ||
          "Unable to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function deleteNotification(
    notificationId
  ) {
    const confirmed =
      window.confirm(
        "Delete this notification?"
      );

    if (!confirmed) {
      return;
    }

    setActiveItemId(
      notificationId
    );
    setError("");

    try {
      await api.delete(
        `/notifications/${notificationId}`
      );

      setNotifications(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              notificationId
          )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.error ||
          "Unable to delete notification."
      );
    } finally {
      setActiveItemId(null);
    }
  }

  if (loading) {
    return (
      <section className="customer-notifications-page">
        <div className="notifications-loading-state">
          <LoaderCircle
            size={38}
            className="notifications-spin"
          />

          <h2>
            Loading notifications
          </h2>

          <p>
            Your latest updates are
            being prepared.
          </p>
        </div>
      </section>
    );
  }

  return (
    <main className="customer-notifications-page">
      <section className="notifications-hero">
        <div>
          <span className="notifications-eyebrow">
            Latest updates
          </span>

          <h1>Notifications</h1>

          <p>
            Review updates about pickups,
            payments, complaints and reward
            activity.
          </p>
        </div>

        <div className="notifications-hero-actions">
          <button
            type="button"
            className="notifications-refresh-button"
            onClick={() =>
              loadNotifications(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? "notifications-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing"
              : "Refresh"}
          </button>

          <button
            type="button"
            className="notifications-primary-button"
            onClick={
              markAllAsRead
            }
            disabled={
              markingAll ||
              unreadCount === 0
            }
          >
            {markingAll ? (
              <>
                <LoaderCircle
                  size={18}
                  className="notifications-spin"
                />
                Updating...
              </>
            ) : (
              <>
                <CheckCheck
                  size={19}
                />
                Mark all read
              </>
            )}
          </button>
        </div>
      </section>

      {error && (
        <div className="notifications-alert notifications-alert-error">
          <CircleAlert size={19} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="notifications-alert notifications-alert-success">
          <CheckCircle2
            size={19}
          />
          <span>{success}</span>
        </div>
      )}

      <section className="notifications-summary-grid">
        <article className="notification-summary-card">
          <div className="notification-summary-icon">
            <Bell size={22} />
          </div>

          <div>
            <span>
              Total notifications
            </span>

            <strong>
              {notifications.length}
            </strong>

            <small>
              All account updates
            </small>
          </div>
        </article>

        <article className="notification-summary-card">
          <div className="notification-summary-icon unread">
            <BellRing size={22} />
          </div>

          <div>
            <span>
              Unread
            </span>

            <strong>
              {unreadCount}
            </strong>

            <small>
              Updates requiring attention
            </small>
          </div>
        </article>

        <article className="notification-summary-card">
          <div className="notification-summary-icon read">
            <CheckCheck size={22} />
          </div>

          <div>
            <span>
              Read
            </span>

            <strong>
              {readCount}
            </strong>

            <small>
              Previously reviewed updates
            </small>
          </div>
        </article>
      </section>

      <section className="notifications-panel">
        <div className="notifications-panel-header">
          <div>
            <span className="notifications-section-label">
              Notification centre
            </span>

            <h2>
              All notifications
            </h2>

            <p>
              {unreadCount} unread
              notification
              {unreadCount === 1
                ? ""
                : "s"}
            </p>
          </div>

          <span className="notifications-count-badge">
            {filteredNotifications.length}
            {" "}
            shown
          </span>
        </div>

        <div className="notifications-toolbar">
          <div className="notifications-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
            />
          </div>

          <div className="notifications-filter">
            <select
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value
                )
              }
            >
              {FILTER_OPTIONS.map(
                (option) => (
                  <option
                    value={
                      option.value
                    }
                    key={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <ChevronDown
              size={17}
            />
          </div>
        </div>

        {filteredNotifications.length ===
        0 ? (
          <div className="notifications-empty-state">
            <div className="notifications-empty-icon">
              <Bell size={33} />
            </div>

            <h3>
              {notifications.length === 0
                ? "No notifications yet"
                : "No matching notifications"}
            </h3>

            <p>
              {notifications.length === 0
                ? "Updates about your pickups, payments, complaints and rewards will appear here."
                : "Try changing the search text or notification filter."}
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map(
              (notification) => {
                const type =
                  getNotificationType(
                    notification
                  );

                const Icon =
                  getNotificationIcon(
                    type
                  );

                const read =
                  isNotificationRead(
                    notification
                  );

                const busy =
                  activeItemId ===
                  notification.id;

                return (
                  <article
                    key={
                      notification.id
                    }
                    className={`notification-item ${
                      read
                        ? "is-read"
                        : "is-unread"
                    }`}
                    onClick={() =>
                      markAsRead(
                        notification
                      )
                    }
                  >
                    <div
                      className={`notification-item-icon notification-icon-${type}`}
                    >
                      <Icon
                        size={22}
                      />
                    </div>

                    <div className="notification-item-content">
                      <div className="notification-item-heading">
                        <div>
                          <h3>
                            {notification.title ||
                              "SmartWaste update"}
                          </h3>

                          <span className="notification-type-label">
                            {type}
                          </span>
                        </div>

                        {!read && (
                          <span className="notification-unread-dot" />
                        )}
                      </div>

                      <p>
                        {notification.message ??
                          notification.body ??
                          "You have a new update."}
                      </p>

                      <div className="notification-item-time">
                        <span>
                          {formatRelativeTime(
                            notification.created_at
                          )}
                        </span>

                        <span>
                          {formatDateTime(
                            notification.created_at
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="notification-item-actions">
                      {!read && (
                        <button
                          type="button"
                          className="notification-read-button"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            markAsRead(
                              notification
                            );
                          }}
                          disabled={
                            busy
                          }
                          title="Mark as read"
                        >
                          {busy ? (
                            <LoaderCircle
                              size={17}
                              className="notifications-spin"
                            />
                          ) : (
                            <CheckCheck
                              size={17}
                            />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        className="notification-delete-button"
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          deleteNotification(
                            notification.id
                          );
                        }}
                        disabled={
                          busy
                        }
                        title="Delete notification"
                      >
                        <Trash2
                          size={17}
                        />
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default CustomerNotifications;