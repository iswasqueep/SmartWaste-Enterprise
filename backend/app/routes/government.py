from flask import Blueprint, jsonify
from sqlalchemy import func

from ..extensions import db
from ..models import (
    ApprovalStatus,
    CollectorProfile,
    PickupRequest,
    PickupStatus,
    RecyclingCompanyProfile,
    Role,
    User,
    WasteCategory,
)
from ..utils import role_required


government_bp = Blueprint("government", __name__)


ACTIVE_PICKUP_STATUSES = {
    PickupStatus.PENDING.value,
    PickupStatus.ASSIGNED.value,
    PickupStatus.ACCEPTED.value,
    PickupStatus.EN_ROUTE.value,
}


@government_bp.get("/government/dashboard")
@role_required(Role.GOVERNMENT.value)
def government_dashboard():
    """
    Read-only government oversight dashboard.

    Government users can monitor system-wide collection and
    recycling performance but cannot create, assign, receive,
    process, or modify operational records through this endpoint.
    """

    total_collections = PickupRequest.query.count()

    pending_collections = (
        PickupRequest.query
        .filter(
            PickupRequest.status.in_(ACTIVE_PICKUP_STATUSES)
        )
        .count()
    )

    completed_collections = (
        PickupRequest.query
        .filter_by(
            status=PickupStatus.COLLECTED.value
        )
        .count()
    )

    cancelled_collections = (
        PickupRequest.query
        .filter_by(
            status=PickupStatus.CANCELLED.value
        )
        .count()
    )

    # Estimated weight across all requests.
    total_estimated_weight = (
        db.session.query(
            func.coalesce(
                func.sum(PickupRequest.estimated_weight),
                0,
            )
        )
        .scalar()
        or 0
    )

    # Actual weight recorded at collection. This deliberately
    # does not substitute estimated weight so the metric remains
    # an actual-weight measure.
    total_actual_weight = (
        db.session.query(
            func.coalesce(
                func.sum(PickupRequest.actual_weight),
                0,
            )
        )
        .scalar()
        or 0
    )

    # Completed recyclable material. If actual weight is missing,
    # fall back to the original estimate for oversight reporting.
    recyclable_weight = (
        db.session.query(
            func.coalesce(
                func.sum(
                    func.coalesce(
                        PickupRequest.actual_weight,
                        PickupRequest.estimated_weight,
                    )
                ),
                0,
            )
        )
        .join(
            WasteCategory,
            PickupRequest.waste_category_id
            == WasteCategory.id,
        )
        .filter(
            PickupRequest.status
            == PickupStatus.COLLECTED.value,
            WasteCategory.recyclable.is_(True),
        )
        .scalar()
        or 0
    )

    completed_total_weight = (
        db.session.query(
            func.coalesce(
                func.sum(
                    func.coalesce(
                        PickupRequest.actual_weight,
                        PickupRequest.estimated_weight,
                    )
                ),
                0,
            )
        )
        .filter(
            PickupRequest.status
            == PickupStatus.COLLECTED.value
        )
        .scalar()
        or 0
    )

    recycling_rate = 0.0
    if completed_total_weight:
        recycling_rate = (
            float(recyclable_weight)
            / float(completed_total_weight)
        ) * 100

    active_collectors = (
        CollectorProfile.query
        .join(
            User,
            CollectorProfile.user_id == User.id,
        )
        .filter(
            User.role == Role.COLLECTOR.value,
            User.is_active.is_(True),
            User.approval_status
            == ApprovalStatus.APPROVED.value,
        )
        .count()
    )

    recycling_companies = (
        RecyclingCompanyProfile.query
        .join(
            User,
            RecyclingCompanyProfile.user_id == User.id,
        )
        .filter(
            User.role == Role.RECYCLING_COMPANY.value,
            User.is_active.is_(True),
        )
        .count()
    )

    completion_rate = 0.0
    if total_collections:
        completion_rate = (
            completed_collections
            / total_collections
        ) * 100

    return jsonify(
        metrics={
            "total_collections": total_collections,
            "pending_collections": pending_collections,
            "completed_collections": completed_collections,
            "cancelled_collections": cancelled_collections,
            "total_estimated_weight": float(
                total_estimated_weight
            ),
            "total_actual_weight": float(
                total_actual_weight
            ),
            "recyclable_weight": float(
                recyclable_weight
            ),
            "recycling_rate": round(
                recycling_rate,
                2,
            ),
            "completion_rate": round(
                completion_rate,
                2,
            ),
            "active_collectors": active_collectors,
            "recycling_companies": recycling_companies,
        }
    ), 200
