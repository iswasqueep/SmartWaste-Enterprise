import {
  Award,
  CheckCircle2,
  Gift,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Medal,
  PackageCheck,
  Recycle,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
  Weight,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";
import "../../styles/customer-rewards.css";

const EMPTY_REWARDS = {
  summary: {
    rewardPoints: 0,
    recycledWeight: 0,
    completedPickups: 0,
    currentLevel: "Bronze",
    nextLevel: "Silver",
    pointsToNextLevel: 100,
    levelProgress: 0,
    carbonSaved: 0,
  },
  history: [],
};

const LEVELS = [
  {
    name: "Bronze",
    minimum: 0,
    maximum: 99,
  },
  {
    name: "Silver",
    minimum: 100,
    maximum: 499,
  },
  {
    name: "Gold",
    minimum: 500,
    maximum: 999,
  },
  {
    name: "Platinum",
    minimum: 1000,
    maximum: null,
  },
];

const ACHIEVEMENTS = [
  {
    id: "first-pickup",
    title: "First Pickup",
    description:
      "Complete your first successful waste collection.",
    target: 1,
    type: "pickups",
    icon: PackageCheck,
  },
  {
    id: "five-pickups",
    title: "Waste Warrior",
    description:
      "Complete at least five successful pickups.",
    target: 5,
    type: "pickups",
    icon: Trophy,
  },
  {
    id: "recycle-fifty",
    title: "Recycling Starter",
    description:
      "Recycle at least 50 kg of recyclable waste.",
    target: 50,
    type: "weight",
    icon: Recycle,
  },
  {
    id: "five-hundred-points",
    title: "Green Champion",
    description:
      "Accumulate at least 500 reward points.",
    target: 500,
    type: "points",
    icon: Award,
  },
];

function numberValue(value, fallback = 0) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

function calculateLevel(points) {
  const safePoints = Math.max(
    numberValue(points),
    0
  );

  if (safePoints >= 1000) {
    return {
      currentLevel: "Platinum",
      nextLevel: null,
      pointsToNextLevel: 0,
      levelProgress: 100,
    };
  }

  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];

  if (safePoints >= 500) {
    currentLevel = LEVELS[2];
    nextLevel = LEVELS[3];
  } else if (safePoints >= 100) {
    currentLevel = LEVELS[1];
    nextLevel = LEVELS[2];
  }

  const range =
    nextLevel.minimum -
    currentLevel.minimum;

  const progress =
    ((safePoints - currentLevel.minimum) /
      range) *
    100;

  return {
    currentLevel: currentLevel.name,
    nextLevel: nextLevel.name,
    pointsToNextLevel: Math.max(
      nextLevel.minimum - safePoints,
      0
    ),
    levelProgress: Math.min(
      Math.max(progress, 0),
      100
    ),
  };
}

function normalizeRewardResponse(responseData) {
  const source =
    responseData?.data ??
    responseData ??
    {};

  const summarySource =
    source.summary ??
    source.stats ??
    source;

  const rewardPoints = numberValue(
    summarySource.reward_points ??
      summarySource.points ??
      summarySource.total_points
  );

  const recycledWeight = numberValue(
    summarySource.recycled_weight_kg ??
      summarySource.recycled_weight ??
      summarySource.total_recycled_weight
  );

  const completedPickups = numberValue(
    summarySource.completed_pickups ??
      summarySource.eligible_pickups ??
      summarySource.pickup_count
  );

  const calculatedLevel =
    calculateLevel(rewardPoints);

  const history =
    source.transactions ??
    source.history ??
    source.items ??
    [];

  return {
    summary: {
      rewardPoints,
      recycledWeight,
      completedPickups,
      carbonSaved: numberValue(
        summarySource.carbon_saved_kg ??
          summarySource.carbon_saved ??
          recycledWeight * 0.42
      ),
      currentLevel:
        summarySource.current_level ??
        calculatedLevel.currentLevel,
      nextLevel:
        summarySource.next_level ??
        calculatedLevel.nextLevel,
      pointsToNextLevel: numberValue(
        summarySource.points_to_next ??
          summarySource.points_to_next_level,
        calculatedLevel.pointsToNextLevel
      ),
      levelProgress: numberValue(
        summarySource.progress ??
          summarySource.level_progress,
        calculatedLevel.levelProgress
      ),
    },
    history: Array.isArray(history)
      ? history
      : [],
  };
}

function formatDate(value) {
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
    }
  ).format(date);
}

function formatNumber(value, decimals = 0) {
  return numberValue(value).toLocaleString(
    "en-NG",
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }
  );
}

function CustomerRewards() {
  const [rewards, setRewards] =
    useState(EMPTY_REWARDS);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadRewards = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        /*
         * Keep your existing endpoint here.
         *
         * Common examples:
         * /customer/rewards
         * /rewards
         * /customer/rewards/summary
         */
        const response = await api.get(
          "/customer/rewards"
        );

        setRewards(
          normalizeRewardResponse(
            response.data
          )
        );
      } catch (requestError) {
        console.error(
          "Unable to load rewards:",
          requestError
        );

        setError(
          requestError.response?.data
            ?.error ||
            "Unable to load your reward information. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const achievements = useMemo(() => {
    const {
      rewardPoints,
      recycledWeight,
      completedPickups,
    } = rewards.summary;

    return ACHIEVEMENTS.map(
      (achievement) => {
        let currentValue = 0;

        if (
          achievement.type ===
          "pickups"
        ) {
          currentValue =
            completedPickups;
        }

        if (
          achievement.type ===
          "weight"
        ) {
          currentValue =
            recycledWeight;
        }

        if (
          achievement.type ===
          "points"
        ) {
          currentValue =
            rewardPoints;
        }

        const progress = Math.min(
          (currentValue /
            achievement.target) *
            100,
          100
        );

        return {
          ...achievement,
          currentValue,
          progress,
          unlocked:
            currentValue >=
            achievement.target,
        };
      }
    );
  }, [rewards.summary]);

  const unlockedAchievementCount =
    achievements.filter(
      (item) => item.unlocked
    ).length;

  if (loading) {
    return (
      <section className="customer-rewards-page">
        <div className="rewards-loading-state">
          <LoaderCircle
            size={38}
            className="rewards-spin"
          />

          <h2>Loading rewards</h2>

          <p>
            Your contribution summary is
            being prepared.
          </p>
        </div>
      </section>
    );
  }

  const { summary, history } =
    rewards;

  return (
    <main className="customer-rewards-page">
      <section className="rewards-hero">
        <div className="rewards-hero-content">
          <span className="rewards-eyebrow">
            <Sparkles size={16} />
            Your contribution
          </span>

          <h1>Rewards</h1>

          <p>
            Earn points from completed
            collections, responsible waste
            disposal and recyclable materials.
          </p>

          <button
            type="button"
            className="rewards-refresh-button"
            onClick={() =>
              loadRewards(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "rewards-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh rewards"}
          </button>
        </div>

        <div className="rewards-points-card">
          <div className="rewards-points-header">
            <div>
              <span>
                Available points
              </span>

              <strong>
                {formatNumber(
                  summary.rewardPoints
                )}
              </strong>
            </div>

            <div className="rewards-gift-icon">
              <Gift size={29} />
            </div>
          </div>

          <div className="rewards-member-level">
            <Medal size={17} />

            <span>
              {summary.currentLevel} member
            </span>
          </div>

          <div className="rewards-points-decoration">
            <Gift size={100} />
          </div>
        </div>
      </section>

      {error && (
        <div
          className="rewards-message rewards-message-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="rewards-stat-grid">
        <article className="rewards-stat-card">
          <div className="rewards-stat-icon">
            <Star size={23} />
          </div>

          <div className="rewards-stat-content">
            <span>Reward points</span>

            <strong>
              {formatNumber(
                summary.rewardPoints
              )}{" "}
              pts
            </strong>

            <small>
              Available for redemption
            </small>
          </div>
        </article>

        <article className="rewards-stat-card">
          <div className="rewards-stat-icon">
            <Weight size={23} />
          </div>

          <div className="rewards-stat-content">
            <span>Recycled waste</span>

            <strong>
              {formatNumber(
                summary.recycledWeight,
                1
              )}{" "}
              kg
            </strong>

            <small>
              Confirmed recyclable materials
            </small>
          </div>
        </article>

        <article className="rewards-stat-card">
          <div className="rewards-stat-icon">
            <PackageCheck size={23} />
          </div>

          <div className="rewards-stat-content">
            <span>Eligible pickups</span>

            <strong>
              {formatNumber(
                summary.completedPickups
              )}
            </strong>

            <small>
              Successful completed collections
            </small>
          </div>
        </article>

        <article className="rewards-stat-card">
          <div className="rewards-stat-icon">
            <Leaf size={23} />
          </div>

          <div className="rewards-stat-content">
            <span>Estimated CO₂ saved</span>

            <strong>
              {formatNumber(
                summary.carbonSaved,
                1
              )}{" "}
              kg
            </strong>

            <small>
              Environmental impact estimate
            </small>
          </div>
        </article>
      </section>

      <section className="rewards-content-grid">
        <article className="rewards-panel rewards-level-panel">
          <div className="rewards-panel-header">
            <div>
              <span className="rewards-section-label">
                Membership level
              </span>

              <h2>
                {summary.currentLevel} Level
              </h2>

              <p>
                Continue completing waste
                collections to unlock more
                benefits.
              </p>
            </div>

            <div className="rewards-panel-icon">
              <Award size={27} />
            </div>
          </div>

          <div className="rewards-level-labels">
            <span>
              {summary.currentLevel}
            </span>

            <strong>
              {summary.nextLevel ??
                "Highest level"}
            </strong>
          </div>

          <div
            className="rewards-progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(
              summary.levelProgress
            )}
          >
            <div
              className="rewards-progress-value"
              style={{
                width: `${Math.min(
                  Math.max(
                    summary.levelProgress,
                    0
                  ),
                  100
                )}%`,
              }}
            />
          </div>

          <div className="rewards-progress-details">
            <span>
              {Math.round(
                summary.levelProgress
              )}
              % completed
            </span>

            <span>
              {summary.nextLevel
                ? `${formatNumber(
                    summary.pointsToNextLevel
                  )} points to ${summary.nextLevel}`
                : "You have reached the highest level"}
            </span>
          </div>

          <div className="rewards-benefit-list">
            <div>
              <CheckCircle2 size={18} />
              Earn points from successful
              pickups
            </div>

            <div>
              <CheckCircle2 size={18} />
              Receive bonuses for recyclable
              waste
            </div>

            <div>
              <CheckCircle2 size={18} />
              Unlock service rewards and
              recognition badges
            </div>
          </div>
        </article>

        <article className="rewards-panel rewards-impact-panel">
          <div className="rewards-panel-header">
            <div>
              <span className="rewards-section-label">
                Green impact
              </span>

              <h2>
                Your environmental
                contribution
              </h2>
            </div>

            <div className="rewards-panel-icon">
              <Leaf size={27} />
            </div>
          </div>

          <div className="rewards-impact-list">
            <div>
              <span>
                Recycled materials
              </span>

              <strong>
                {formatNumber(
                  summary.recycledWeight,
                  1
                )}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>
                Carbon reduction
              </span>

              <strong>
                {formatNumber(
                  summary.carbonSaved,
                  1
                )}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>
                Completed pickups
              </span>

              <strong>
                {formatNumber(
                  summary.completedPickups
                )}
              </strong>
            </div>
          </div>

          <p className="rewards-impact-note">
            Environmental values are estimates
            based on successfully completed
            recyclable-waste collections.
          </p>
        </article>
      </section>

      <section className="rewards-panel">
        <div className="rewards-panel-header">
          <div>
            <span className="rewards-section-label">
              Milestones
            </span>

            <h2>Achievements</h2>

            <p>
              {unlockedAchievementCount} of{" "}
              {achievements.length} achievements
              unlocked.
            </p>
          </div>
        </div>

        <div className="rewards-achievement-grid">
          {achievements.map(
            (achievement) => {
              const Icon =
                achievement.icon;

              return (
                <article
                  key={achievement.id}
                  className={`rewards-achievement-card ${
                    achievement.unlocked
                      ? "is-unlocked"
                      : "is-locked"
                  }`}
                >
                  <div className="rewards-achievement-top">
                    <div className="rewards-achievement-icon">
                      <Icon size={23} />
                    </div>

                    <span className="rewards-achievement-status">
                      {achievement.unlocked ? (
                        <>
                          <CheckCircle2
                            size={15}
                          />
                          Unlocked
                        </>
                      ) : (
                        <>
                          <LockKeyhole
                            size={15}
                          />
                          Locked
                        </>
                      )}
                    </span>
                  </div>

                  <h3>
                    {achievement.title}
                  </h3>

                  <p>
                    {
                      achievement.description
                    }
                  </p>

                  <div className="rewards-achievement-progress">
                    <div>
                      <span
                        style={{
                          width: `${achievement.progress}%`,
                        }}
                      />
                    </div>

                    <small>
                      {formatNumber(
                        achievement.currentValue,
                        achievement.type ===
                          "weight"
                          ? 1
                          : 0
                      )}{" "}
                      /{" "}
                      {formatNumber(
                        achievement.target
                      )}
                    </small>
                  </div>
                </article>
              );
            }
          )}
        </div>
      </section>

      <section className="rewards-panel">
        <div className="rewards-panel-header">
          <div>
            <span className="rewards-section-label">
              Account activity
            </span>

            <h2>Reward history</h2>

            <p>
              View points earned from your
              completed waste collections.
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rewards-empty-state">
            <div className="rewards-empty-icon">
              <Gift size={31} />
            </div>

            <h3>
              No reward activity yet
            </h3>

            <p>
              Complete an eligible pickup to
              earn your first SmartWaste reward
              points.
            </p>
          </div>
        ) : (
          <div className="rewards-table-wrapper">
            <table className="rewards-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Pickup</th>
                  <th>Points</th>
                  <th>Balance</th>
                </tr>
              </thead>

              <tbody>
                {history.map(
                  (transaction, index) => {
                    const points =
                      numberValue(
                        transaction.points ??
                          transaction.reward_points
                      );

                    return (
                      <tr
                        key={
                          transaction.id ??
                          `${transaction.created_at}-${index}`
                        }
                      >
                        <td>
                          {formatDate(
                            transaction.created_at ??
                              transaction.date
                          )}
                        </td>

                        <td>
                          {transaction.description ??
                            transaction.reason ??
                            "Reward points earned"}
                        </td>

                        <td>
                          {transaction.pickup_reference ??
                            transaction.reference ??
                            transaction.pickup_id ??
                            "—"}
                        </td>

                        <td
                          className={
                            points >= 0
                              ? "rewards-positive-points"
                              : "rewards-negative-points"
                          }
                        >
                          {points >= 0
                            ? "+"
                            : ""}
                          {formatNumber(
                            points
                          )}
                        </td>

                        <td>
                          {formatNumber(
                            transaction.balance_after ??
                              transaction.balance ??
                              0
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default CustomerRewards;