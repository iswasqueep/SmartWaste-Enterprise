from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from ..extensions import db
from ..models import (
    ApprovalStatus,
    CollectorProfile,
    Invoice,
    PaymentStatus,
    PickupRequest,
    PickupStatus,
    Role,
    SystemSetting,
    User,
    Vehicle,
    WasteCategory,
)
from ..services.notifications import notify
from ..utils import role_required


admin_bp = Blueprint("admin", __name__)


def start_of_day(day_value: date) -> datetime:
    """Return midnight for a date using UTC."""

    return datetime.combine(
        day_value,
        time.min,
        tzinfo=timezone.utc,
    )


def commit_or_rollback():
    """Commit database changes and roll back on failure."""

    try:
        db.session.commit()
        return None
    except Exception as error:
        db.session.rollback()
        print(f"Database operation failed: {error}")
        return jsonify(error="Database operation failed"), 500


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@admin_bp.get("/admin/dashboard")
@role_required(Role.ADMIN.value)
def admin_dashboard():
    """Return live dashboard statistics for administrators."""

    today = date.today()
    month_start = today.replace(day=1)
    trend_start = today - timedelta(days=6)

    total_users = User.query.count()

    active_users = User.query.filter_by(
        is_active=True,
    ).count()

    pending_approvals = User.query.filter_by(
        approval_status=ApprovalStatus.PENDING.value,
    ).count()

    customer_count = User.query.filter_by(
        role=Role.CUSTOMER.value,
    ).count()

    collector_count = User.query.filter_by(
        role=Role.COLLECTOR.value,
    ).count()

    recycling_company_count = User.query.filter_by(
        role=Role.RECYCLING_COMPANY.value,
    ).count()

    government_count = User.query.filter_by(
        role=Role.GOVERNMENT.value,
    ).count()

    active_collectors = User.query.filter_by(
        role=Role.COLLECTOR.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=True,
    ).count()

    available_collectors = (
        CollectorProfile.query
        .join(
            User,
            CollectorProfile.user_id == User.id,
        )
        .filter(
            User.role == Role.COLLECTOR.value,
            User.approval_status
            == ApprovalStatus.APPROVED.value,
            User.is_active.is_(True),
            CollectorProfile.availability_status
            == "available",
        )
        .count()
    )

    available_vehicles = Vehicle.query.filter_by(
        status="available",
    ).count()

    total_vehicles = Vehicle.query.count()

    active_pickup_statuses = [
        PickupStatus.PENDING.value,
        PickupStatus.ASSIGNED.value,
        PickupStatus.ACCEPTED.value,
        PickupStatus.EN_ROUTE.value,
    ]

    pending_pickups = PickupRequest.query.filter(
        PickupRequest.status.in_(
            active_pickup_statuses,
        )
    ).count()

    unassigned_pickups = PickupRequest.query.filter_by(
        status=PickupStatus.PENDING.value,
    ).count()

    completed_pickups = PickupRequest.query.filter_by(
        status=PickupStatus.COLLECTED.value,
    ).count()

    cancelled_pickups = PickupRequest.query.filter_by(
        status=PickupStatus.CANCELLED.value,
    ).count()

    total_pickups = PickupRequest.query.count()

    today_pickups = PickupRequest.query.filter(
        PickupRequest.pickup_date == today,
    ).count()

    total_revenue = (
        db.session.query(
            func.coalesce(
                func.sum(Invoice.total),
                0,
            )
        )
        .filter(
            Invoice.status == PaymentStatus.PAID.value,
        )
        .scalar()
    )

    monthly_revenue = (
        db.session.query(
            func.coalesce(
                func.sum(Invoice.total),
                0,
            )
        )
        .filter(
            Invoice.status == PaymentStatus.PAID.value,
            Invoice.created_at
            >= start_of_day(month_start),
        )
        .scalar()
    )

    total_weight = (
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
            == PickupStatus.COLLECTED.value,
        )
        .scalar()
    )

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
    )

    total_weight_value = float(total_weight or 0)

    recyclable_weight_value = float(
        recyclable_weight or 0
    )

    completion_rate = (
        round(
            completed_pickups
            / total_pickups
            * 100,
            2,
        )
        if total_pickups
        else 0
    )

    recycling_rate = (
        round(
            recyclable_weight_value
            / total_weight_value
            * 100,
            2,
        )
        if total_weight_value
        else 0
    )

    trend_rows = (
        db.session.query(
            func.date(
                PickupRequest.created_at
            ).label("created_day"),
            func.count(
                PickupRequest.id
            ).label("collections"),
        )
        .filter(
            PickupRequest.created_at
            >= start_of_day(trend_start),
        )
        .group_by(
            func.date(
                PickupRequest.created_at
            )
        )
        .all()
    )

    trend_lookup = {
        row.created_day: int(
            row.collections or 0
        )
        for row in trend_rows
    }

    collection_trend = []

    for offset in range(7):
        current_day = trend_start + timedelta(
            days=offset
        )

        collection_trend.append(
            {
                "date": current_day.isoformat(),
                "day": current_day.strftime("%a"),
                "collections": trend_lookup.get(
                    current_day,
                    0,
                ),
            }
        )

    waste_rows = (
        db.session.query(
            WasteCategory.name,
            func.coalesce(
                func.sum(
                    func.coalesce(
                        PickupRequest.actual_weight,
                        PickupRequest.estimated_weight,
                    )
                ),
                0,
            ).label("weight"),
        )
        .join(
            PickupRequest,
            PickupRequest.waste_category_id
            == WasteCategory.id,
        )
        .group_by(
            WasteCategory.name,
        )
        .order_by(
            func.sum(
                func.coalesce(
                    PickupRequest.actual_weight,
                    PickupRequest.estimated_weight,
                )
            ).desc()
        )
        .all()
    )

    recent_pickups = (
        PickupRequest.query
        .order_by(
            PickupRequest.created_at.desc()
        )
        .limit(6)
        .all()
    )

    recent_users = (
        User.query
        .order_by(
            User.created_at.desc()
        )
        .limit(6)
        .all()
    )

    return jsonify(
        summary={
            "total_users": total_users,
            "active_users": active_users,
            "pending_approvals": pending_approvals,
            "customers": customer_count,
            "collectors": collector_count,
            "recycling_companies": (
                recycling_company_count
            ),
            "government_agencies": (
                government_count
            ),
            "active_collectors": active_collectors,
            "available_collectors": (
                available_collectors
            ),
            "total_vehicles": total_vehicles,
            "available_vehicles": (
                available_vehicles
            ),
            "total_pickups": total_pickups,
            "pending_pickups": pending_pickups,
            "unassigned_pickups": (
                unassigned_pickups
            ),
            "completed_pickups": (
                completed_pickups
            ),
            "cancelled_pickups": (
                cancelled_pickups
            ),
            "today_pickups": today_pickups,
            "completion_rate": completion_rate,
            "total_weight_kg": (
                total_weight_value
            ),
            "recycling_rate": recycling_rate,
            "total_revenue": float(
                total_revenue or 0
            ),
            "monthly_revenue": float(
                monthly_revenue or 0
            ),
        },
        collection_trend=collection_trend,
        waste_distribution=[
            {
                "category": category,
                "weight_kg": float(
                    weight or 0
                ),
            }
            for category, weight in waste_rows
        ],
        recent_pickups=[
            pickup.to_dict()
            for pickup in recent_pickups
        ],
        recent_users=[
            user.to_dict()
            for user in recent_users
        ],
    )


# =========================================================
# USER MANAGEMENT
# =========================================================

@admin_bp.get("/admin/users")
@role_required(Role.ADMIN.value)
def users():
    approval_status = str(
        request.args.get(
            "approval_status",
            "",
        )
    ).strip().lower()

    role = str(
        request.args.get(
            "role",
            "",
        )
    ).strip().lower()

    search = str(
        request.args.get(
            "search",
            "",
        )
    ).strip()

    query = User.query

    if approval_status:
        allowed_approval_statuses = {
            ApprovalStatus.PENDING.value,
            ApprovalStatus.APPROVED.value,
            ApprovalStatus.REJECTED.value,
        }

        if (
            approval_status
            not in allowed_approval_statuses
        ):
            return jsonify(
                error=(
                    "Invalid approval_status filter"
                )
            ), 400

        query = query.filter_by(
            approval_status=approval_status,
        )

    if role:
        allowed_roles = {
            item.value for item in Role
        }

        if role not in allowed_roles:
            return jsonify(
                error="Invalid role filter"
            ), 400

        query = query.filter_by(
            role=role,
        )

    if search:
        search_value = f"%{search}%"

        query = query.filter(
            or_(
                User.full_name.ilike(
                    search_value
                ),
                User.email.ilike(
                    search_value
                ),
                User.phone.ilike(
                    search_value
                ),
            )
        )

    rows = query.order_by(
        User.created_at.desc()
    ).all()

    return jsonify(
        items=[
            row.to_dict()
            for row in rows
        ],
        total=len(rows),
    )


@admin_bp.patch(
    "/admin/users/<int:user_id>/approval"
)
@role_required(Role.ADMIN.value)
def update_user_approval(user_id):
    user = db.session.get(
        User,
        user_id,
    )

    if not user:
        return jsonify(
            error="User not found"
        ), 404

    if user.role == Role.ADMIN.value:
        return jsonify(
            error=(
                "Administrator approval cannot "
                "be changed through this endpoint"
            )
        ), 400

    data = request.get_json(
        silent=True
    ) or {}

    approval_status = str(
        data.get(
            "approval_status",
            "",
        )
    ).strip().lower()

    allowed = {
        ApprovalStatus.PENDING.value,
        ApprovalStatus.APPROVED.value,
        ApprovalStatus.REJECTED.value,
    }

    if approval_status not in allowed:
        return jsonify(
            error=(
                "approval_status must be "
                "pending, approved or rejected"
            )
        ), 400

    user.approval_status = approval_status

    user.is_active = (
        approval_status
        == ApprovalStatus.APPROVED.value
    )

    if user.role == Role.COLLECTOR.value:
        profile = (
            CollectorProfile.query
            .filter_by(
                user_id=user.id
            )
            .first()
        )

        if profile:
            profile.availability_status = (
                "available"
                if approval_status
                == ApprovalStatus.APPROVED.value
                else "unavailable"
            )

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message=(
            "User approval status updated"
        ),
        user=user.to_dict(),
    )


@admin_bp.patch(
    "/admin/users/<int:user_id>/status"
)
@role_required(Role.ADMIN.value)
def update_user_status(user_id):
    user = db.session.get(
        User,
        user_id,
    )

    if not user:
        return jsonify(
            error="User not found"
        ), 404

    if user.role == Role.ADMIN.value:
        return jsonify(
            error=(
                "Administrator accounts cannot "
                "be disabled through this endpoint"
            )
        ), 400

    data = request.get_json(
        silent=True
    ) or {}

    if (
        "is_active" not in data
        or not isinstance(
            data["is_active"],
            bool,
        )
    ):
        return jsonify(
            error=(
                "is_active must be true or false"
            )
        ), 400

    user.is_active = data[
        "is_active"
    ]

    if (
        user.role
        == Role.COLLECTOR.value
        and not user.is_active
    ):
        profile = (
            CollectorProfile.query
            .filter_by(
                user_id=user.id
            )
            .first()
        )

        if profile:
            profile.availability_status = (
                "unavailable"
            )

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message="User status updated",
        user=user.to_dict(),
    )


# =========================================================
# WASTE CATEGORY MANAGEMENT
# =========================================================

@admin_bp.get("/admin/waste-categories")
@role_required(Role.ADMIN.value)
def list_waste_categories():
    categories = (
        WasteCategory.query
        .order_by(
            WasteCategory.name.asc()
        )
        .all()
    )

    return jsonify(
        items=[
            category.to_dict()
            for category in categories
        ]
    )


@admin_bp.post("/admin/waste-categories")
@role_required(Role.ADMIN.value)
def create_category():
    data = request.get_json(
        silent=True
    ) or {}

    name = str(
        data.get(
            "name",
            "",
        )
    ).strip()

    if not name:
        return jsonify(
            error="Category name is required"
        ), 400

    try:
        price = Decimal(
            str(
                data.get(
                    "price_per_kg",
                    "0",
                )
            )
        )
    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ):
        return jsonify(
            error=(
                "price_per_kg must be "
                "a valid number"
            )
        ), 400

    if price < 0:
        return jsonify(
            error=(
                "price_per_kg cannot "
                "be negative"
            )
        ), 400

    existing = (
        WasteCategory.query
        .filter(
            func.lower(
                WasteCategory.name
            )
            == name.lower()
        )
        .first()
    )

    if existing:
        return jsonify(
            error=(
                "A category with this "
                "name already exists"
            )
        ), 409

    category = WasteCategory(
        name=name,
        description=str(
            data.get(
                "description",
                "",
            )
        ).strip() or None,
        recyclable=bool(
            data.get(
                "recyclable",
                False,
            )
        ),
        price_per_kg=price,
        active=True,
    )

    db.session.add(category)

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message="Waste category created",
        category=category.to_dict(),
    ), 201


# =========================================================
# COLLECTOR MANAGEMENT
# =========================================================

@admin_bp.get("/admin/collectors")
@role_required(Role.ADMIN.value)
def collectors():
    rows = (
        CollectorProfile.query
        .join(
            User,
            CollectorProfile.user_id
            == User.id,
        )
        .order_by(
            User.full_name.asc()
        )
        .all()
    )

    return jsonify(
        items=[
            row.to_dict()
            for row in rows
        ]
    )


@admin_bp.patch("/admin/collectors/<int:collector_id>/vehicle")
@role_required(Role.ADMIN.value)
def assign_collector_vehicle(collector_id):
    profile = db.session.get(
        CollectorProfile,
        collector_id,
    )

    if not profile:
        return jsonify(
            error="Collector profile not found"
        ), 404

    collector = profile.user

    if not collector:
        return jsonify(
            error="Collector user account not found"
        ), 404

    if collector.role != Role.COLLECTOR.value:
        return jsonify(
            error="Selected user is not a collector"
        ), 400

    data = request.get_json(
        silent=True
    ) or {}

    vehicle_id = data.get("vehicle_id")

    if not vehicle_id:
        return jsonify(
            error="vehicle_id is required"
        ), 400

    vehicle = db.session.get(
        Vehicle,
        vehicle_id,
    )

    if not vehicle:
        return jsonify(
            error="Vehicle not found"
        ), 404

    existing_profile = (
        CollectorProfile.query
        .filter(
            CollectorProfile.vehicle_id == vehicle.id,
            CollectorProfile.id != profile.id,
        )
        .first()
    )

    if existing_profile:
        return jsonify(
            error=(
                "This vehicle is already assigned "
                "to another collector"
            )
        ), 409

    if profile.vehicle_id:
        old_vehicle = db.session.get(
            Vehicle,
            profile.vehicle_id,
        )

        if old_vehicle and old_vehicle.id != vehicle.id:
            old_vehicle.status = "available"

    profile.vehicle_id = vehicle.id
    vehicle.status = "assigned"

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message="Vehicle assigned to collector",
        collector=profile.to_dict(),
    )


# =========================================================
# VEHICLE MANAGEMENT
# =========================================================

@admin_bp.get("/admin/vehicles")
@role_required(Role.ADMIN.value)
def list_vehicles():
    status = str(
        request.args.get(
            "status",
            "",
        )
    ).strip().lower()

    query = Vehicle.query

    if status:
        query = query.filter_by(
            status=status,
        )

    vehicles = query.order_by(
        Vehicle.created_at.desc()
    ).all()

    return jsonify(
        items=[
            vehicle.to_dict()
            for vehicle in vehicles
        ]
    )


@admin_bp.post("/admin/vehicles")
@role_required(Role.ADMIN.value)
def create_vehicle():
    data = request.get_json(
        silent=True
    ) or {}

    registration = str(
        data.get(
            "registration_number",
            "",
        )
    ).strip().upper()

    vehicle_type = str(
        data.get(
            "vehicle_type",
            "Waste Truck",
        )
    ).strip()

    try:
        capacity = Decimal(
            str(
                data.get(
                    "capacity_kg",
                    "1000",
                )
            )
        )
    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ):
        return jsonify(
            error=(
                "capacity_kg must be "
                "a valid number"
            )
        ), 400

    if not registration:
        return jsonify(
            error=(
                "registration_number "
                "is required"
            )
        ), 400

    if not vehicle_type:
        return jsonify(
            error=(
                "vehicle_type is required"
            )
        ), 400

    if capacity <= 0:
        return jsonify(
            error=(
                "capacity_kg must be "
                "greater than zero"
            )
        ), 400

    existing = Vehicle.query.filter_by(
        registration_number=registration,
    ).first()

    if existing:
        return jsonify(
            error=(
                "A vehicle with this "
                "registration number "
                "already exists"
            )
        ), 409

    vehicle = Vehicle(
        registration_number=registration,
        vehicle_type=vehicle_type,
        capacity_kg=capacity,
        status="available",
    )

    db.session.add(vehicle)

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message="Vehicle created",
        vehicle=vehicle.to_dict(),
    ), 201



# =========================================================
# PAYMENT MANAGEMENT
# =========================================================

@admin_bp.get("/admin/payments")
@role_required(Role.ADMIN.value)
def list_admin_payments():
    """Return paginated invoices and payment summary data."""

    page = max(
        1,
        request.args.get(
            "page",
            1,
            type=int,
        ),
    )

    per_page = min(
        max(
            1,
            request.args.get(
                "per_page",
                10,
                type=int,
            ),
        ),
        100,
    )

    status = str(
        request.args.get(
            "status",
            "",
        )
    ).strip().lower()

    valid_statuses = {
        item.value for item in PaymentStatus
    }

    if status and status not in valid_statuses:
        return jsonify(
            error=(
                "Invalid payment status. "
                f"Allowed values: {', '.join(sorted(valid_statuses))}"
            )
        ), 400

    query = Invoice.query

    if status:
        query = query.filter(
            Invoice.status == status
        )

    pagination = (
        query
        .order_by(
            Invoice.created_at.desc()
        )
        .paginate(
            page=page,
            per_page=per_page,
            error_out=False,
        )
    )

    status_counts = dict(
        db.session.query(
            Invoice.status,
            func.count(Invoice.id),
        )
        .group_by(
            Invoice.status
        )
        .all()
    )

    total_revenue = (
        db.session.query(
            func.coalesce(
                func.sum(Invoice.total),
                0,
            )
        )
        .filter(
            Invoice.status
            == PaymentStatus.PAID.value
        )
        .scalar()
    )

    monthly_revenue = (
        db.session.query(
            func.coalesce(
                func.sum(Invoice.total),
                0,
            )
        )
        .filter(
            Invoice.status
            == PaymentStatus.PAID.value,
            Invoice.created_at
            >= start_of_day(
                date.today().replace(day=1)
            ),
        )
        .scalar()
    )

    items = []

    for invoice in pagination.items:
        item = invoice.to_dict()

        # Supply predictable fields expected by Payments.jsx,
        # while preserving everything already returned by to_dict().
        item.setdefault(
            "id",
            invoice.id,
        )
        item.setdefault(
            "status",
            invoice.status,
        )
        item.setdefault(
            "total",
            float(invoice.total or 0),
        )
        item.setdefault(
            "created_at",
            (
                invoice.created_at.isoformat()
                if invoice.created_at
                else None
            ),
        )

        items.append(item)

    return jsonify(
        items=items,
        meta={
            "page": pagination.page,
            "pages": pagination.pages,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "has_next": pagination.has_next,
            "has_prev": pagination.has_prev,
        },
        summary={
            "total_revenue": float(
                total_revenue or 0
            ),
            "monthly_revenue": float(
                monthly_revenue or 0
            ),
            "total_count": Invoice.query.count(),
            "paid_count": int(
                status_counts.get(
                    PaymentStatus.PAID.value,
                    0,
                )
            ),
            "pending_count": int(
                status_counts.get(
                    PaymentStatus.PENDING.value,
                    0,
                )
            ),
            "failed_count": int(
                status_counts.get(
                    "failed",
                    0,
                )
            ),
            "cancelled_count": int(
                status_counts.get(
                    "cancelled",
                    0,
                )
            ),
        },
    )

@admin_bp.get("/admin/reports")
@role_required(Role.ADMIN.value)
def admin_reports():
    """Return operational reporting data for administrators."""

    days = request.args.get(
        "days",
        30,
        type=int,
    )

    allowed_days = {
        7,
        30,
        90,
        365,
    }

    if days not in allowed_days:
        return jsonify(
            error=(
                "days must be one of "
                "7, 30, 90 or 365"
            )
        ), 400

    today = date.today()
    period_start = today - timedelta(
        days=days - 1
    )

    start_datetime = start_of_day(
        period_start
    )

    pickups_query = PickupRequest.query.filter(
        PickupRequest.created_at
        >= start_datetime
    )

    total_pickups = pickups_query.count()

    completed_pickups = pickups_query.filter(
        PickupRequest.status
        == PickupStatus.COLLECTED.value
    ).count()

    total_weight = (
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
            PickupRequest.created_at
            >= start_datetime,
            PickupRequest.status
            == PickupStatus.COLLECTED.value,
        )
        .scalar()
    )

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
            PickupRequest.created_at
            >= start_datetime,
            PickupRequest.status
            == PickupStatus.COLLECTED.value,
            WasteCategory.recyclable.is_(True),
        )
        .scalar()
    )

    total_revenue = (
        db.session.query(
            func.coalesce(
                func.sum(Invoice.total),
                0,
            )
        )
        .filter(
            Invoice.created_at
            >= start_datetime,
            Invoice.status
            == PaymentStatus.PAID.value,
        )
        .scalar()
    )

    total_weight_value = float(
        total_weight or 0
    )

    recyclable_weight_value = float(
        recyclable_weight or 0
    )

    completion_rate = (
        round(
            completed_pickups
            / total_pickups
            * 100,
            2,
        )
        if total_pickups
        else 0
    )

    recycling_rate = (
        round(
            recyclable_weight_value
            / total_weight_value
            * 100,
            2,
        )
        if total_weight_value
        else 0
    )

    collection_rows = (
        db.session.query(
            func.date(
                PickupRequest.created_at
            ).label("report_day"),
            func.count(
                PickupRequest.id
            ).label("collections"),
        )
        .filter(
            PickupRequest.created_at
            >= start_datetime
        )
        .group_by(
            func.date(
                PickupRequest.created_at
            )
        )
        .order_by(
            func.date(
                PickupRequest.created_at
            )
        )
        .all()
    )

    collection_lookup = {
        row.report_day: int(
            row.collections or 0
        )
        for row in collection_rows
    }

    collection_trend = []

    for offset in range(days):
        current_day = period_start + timedelta(
            days=offset
        )

        collection_trend.append(
            {
                "date": current_day.isoformat(),
                "label": current_day.strftime(
                    "%d %b"
                ),
                "collections": (
                    collection_lookup.get(
                        current_day,
                        0,
                    )
                ),
            }
        )

    revenue_rows = (
        db.session.query(
            func.date(
                Invoice.created_at
            ).label("report_day"),
            func.coalesce(
                func.sum(Invoice.total),
                0,
            ).label("revenue"),
        )
        .filter(
            Invoice.created_at
            >= start_datetime,
            Invoice.status
            == PaymentStatus.PAID.value,
        )
        .group_by(
            func.date(
                Invoice.created_at
            )
        )
        .order_by(
            func.date(
                Invoice.created_at
            )
        )
        .all()
    )

    revenue_lookup = {
        row.report_day: float(
            row.revenue or 0
        )
        for row in revenue_rows
    }

    revenue_trend = []

    for offset in range(days):
        current_day = period_start + timedelta(
            days=offset
        )

        revenue_trend.append(
            {
                "date": current_day.isoformat(),
                "label": current_day.strftime(
                    "%d %b"
                ),
                "revenue": revenue_lookup.get(
                    current_day,
                    0,
                ),
            }
        )

    pickup_status_rows = (
        db.session.query(
            PickupRequest.status,
            func.count(
                PickupRequest.id
            ),
        )
        .filter(
            PickupRequest.created_at
            >= start_datetime
        )
        .group_by(
            PickupRequest.status
        )
        .all()
    )

    user_rows = (
        db.session.query(
            User.role,
            func.count(User.id),
        )
        .group_by(
            User.role
        )
        .all()
    )

    waste_rows = (
        db.session.query(
            WasteCategory.name,
            func.coalesce(
                func.sum(
                    func.coalesce(
                        PickupRequest.actual_weight,
                        PickupRequest.estimated_weight,
                    )
                ),
                0,
            ).label("weight"),
        )
        .join(
            PickupRequest,
            PickupRequest.waste_category_id
            == WasteCategory.id,
        )
        .filter(
            PickupRequest.created_at
            >= start_datetime,
            PickupRequest.status
            == PickupStatus.COLLECTED.value,
        )
        .group_by(
            WasteCategory.name
        )
        .order_by(
            func.sum(
                func.coalesce(
                    PickupRequest.actual_weight,
                    PickupRequest.estimated_weight,
                )
            ).desc()
        )
        .all()
    )

    return jsonify(
        period={
            "days": days,
            "start_date": period_start.isoformat(),
            "end_date": today.isoformat(),
        },
        summary={
            "total_users": User.query.count(),
            "active_users": User.query.filter_by(
                is_active=True
            ).count(),
            "total_pickups": total_pickups,
            "completed_pickups": (
                completed_pickups
            ),
            "completion_rate": completion_rate,
            "total_weight_kg": (
                total_weight_value
            ),
            "recycling_rate": recycling_rate,
            "total_revenue": float(
                total_revenue or 0
            ),
        },
        collection_trend=collection_trend,
        revenue_trend=revenue_trend,
        pickup_status_distribution=[
            {
                "status": status,
                "count": int(count or 0),
            }
            for status, count
            in pickup_status_rows
        ],
        user_distribution=[
            {
                "role": role.replace(
                    "_",
                    " ",
                ).title(),
                "count": int(count or 0),
            }
            for role, count
            in user_rows
        ],
        waste_distribution=[
            {
                "category": category,
                "weight_kg": float(
                    weight or 0
                ),
            }
            for category, weight
            in waste_rows
        ],
    )



# =========================================================
# SYSTEM SETTINGS MANAGEMENT
# =========================================================

DEFAULT_ADMIN_SETTINGS = {
    "organization": {
        "organization_name": "SmartWaste",
        "support_email": "",
        "support_phone": "",
        "address": "",
        "timezone": "Africa/Lagos",
        "currency": "NGN",
    },
    "operations": {
        "default_pickup_fee": 0,
        "minimum_pickup_weight_kg": 1,
        "maximum_pickup_weight_kg": 10000,
        "assignment_timeout_minutes": 30,
        "auto_assign_collectors": False,
        "allow_same_day_pickup": True,
    },
    "notifications": {
        "email_notifications": True,
        "sms_notifications": False,
        "notify_admin_new_user": True,
        "notify_admin_new_pickup": True,
        "notify_customer_assignment": True,
        "notify_collector_assignment": True,
    },
    "security": {
        "session_timeout_minutes": 60,
        "require_strong_passwords": True,
        "require_admin_2fa": False,
        "lock_account_after_attempts": 5,
        "audit_logging_enabled": True,
    },
    "appearance": {
        "brand_name": "SmartWaste",
        "dashboard_compact_mode": False,
        "show_welcome_banner": True,
    },
}


def merge_admin_settings(stored_settings):
    """Merge persisted settings with supported defaults."""

    source = (
        stored_settings
        if isinstance(stored_settings, dict)
        else {}
    )

    merged = {}

    for section, defaults in (
        DEFAULT_ADMIN_SETTINGS.items()
    ):
        stored_section = source.get(
            section,
            {},
        )

        if not isinstance(
            stored_section,
            dict,
        ):
            stored_section = {}

        merged[section] = {
            **defaults,
            **stored_section,
        }

    return merged


def validate_admin_settings(settings):
    """Validate settings and return an error message when invalid."""

    organization = settings["organization"]
    operations = settings["operations"]
    security = settings["security"]

    if not str(
        organization.get(
            "organization_name",
            "",
        )
    ).strip():
        return "organization_name is required"

    if not str(
        organization.get(
            "brand_name",
            settings["appearance"].get(
                "brand_name",
                "",
            ),
        )
    ).strip() and not str(
        settings["appearance"].get(
            "brand_name",
            "",
        )
    ).strip():
        return "brand_name is required"

    try:
        default_fee = Decimal(
            str(
                operations[
                    "default_pickup_fee"
                ]
            )
        )

        minimum_weight = Decimal(
            str(
                operations[
                    "minimum_pickup_weight_kg"
                ]
            )
        )

        maximum_weight = Decimal(
            str(
                operations[
                    "maximum_pickup_weight_kg"
                ]
            )
        )

        assignment_timeout = int(
            operations[
                "assignment_timeout_minutes"
            ]
        )

        session_timeout = int(
            security[
                "session_timeout_minutes"
            ]
        )

        lock_attempts = int(
            security[
                "lock_account_after_attempts"
            ]
        )
    except (
        InvalidOperation,
        TypeError,
        ValueError,
        KeyError,
    ):
        return (
            "Numeric settings contain an invalid value"
        )

    if default_fee < 0:
        return "default_pickup_fee cannot be negative"

    if minimum_weight < 0:
        return (
            "minimum_pickup_weight_kg cannot be negative"
        )

    if maximum_weight <= minimum_weight:
        return (
            "maximum_pickup_weight_kg must be greater "
            "than minimum_pickup_weight_kg"
        )

    if assignment_timeout < 1:
        return (
            "assignment_timeout_minutes must be at least 1"
        )

    if session_timeout < 5:
        return (
            "session_timeout_minutes must be at least 5"
        )

    if lock_attempts < 1:
        return (
            "lock_account_after_attempts must be at least 1"
        )

    expected_boolean_fields = {
        "operations": {
            "auto_assign_collectors",
            "allow_same_day_pickup",
        },
        "notifications": {
            "email_notifications",
            "sms_notifications",
            "notify_admin_new_user",
            "notify_admin_new_pickup",
            "notify_customer_assignment",
            "notify_collector_assignment",
        },
        "security": {
            "require_strong_passwords",
            "require_admin_2fa",
            "audit_logging_enabled",
        },
        "appearance": {
            "dashboard_compact_mode",
            "show_welcome_banner",
        },
    }

    for section, fields in (
        expected_boolean_fields.items()
    ):
        for field in fields:
            if not isinstance(
                settings[section][field],
                bool,
            ):
                return (
                    f"{section}.{field} must be true or false"
                )

    return None


@admin_bp.get("/admin/settings")
@role_required(Role.ADMIN.value)
def get_admin_settings():
    """Return persisted administrator settings with defaults."""

    row = SystemSetting.query.filter_by(
        key="admin_settings",
    ).first()

    settings = merge_admin_settings(
        row.value if row else {}
    )

    return jsonify(
        settings=settings,
    )


@admin_bp.patch("/admin/settings")
@role_required(Role.ADMIN.value)
def update_admin_settings():
    """Validate and persist administrator settings."""

    data = request.get_json(
        silent=True
    ) or {}

    incoming = data.get(
        "settings"
    )

    if not isinstance(
        incoming,
        dict,
    ):
        return jsonify(
            error="settings must be an object"
        ), 400

    allowed_sections = set(
        DEFAULT_ADMIN_SETTINGS.keys()
    )

    unknown_sections = (
        set(incoming.keys())
        - allowed_sections
    )

    if unknown_sections:
        return jsonify(
            error=(
                "Unknown settings section(s): "
                + ", ".join(
                    sorted(unknown_sections)
                )
            )
        ), 400

    row = SystemSetting.query.filter_by(
        key="admin_settings",
    ).first()

    current_settings = merge_admin_settings(
        row.value if row else {}
    )

    for section, values in incoming.items():
        if not isinstance(
            values,
            dict,
        ):
            return jsonify(
                error=(
                    f"{section} must be an object"
                )
            ), 400

        allowed_keys = set(
            DEFAULT_ADMIN_SETTINGS[
                section
            ].keys()
        )

        unknown_keys = (
            set(values.keys())
            - allowed_keys
        )

        if unknown_keys:
            return jsonify(
                error=(
                    f"Unknown {section} setting(s): "
                    + ", ".join(
                        sorted(unknown_keys)
                    )
                )
            ), 400

        current_settings[
            section
        ].update(values)

    validation_error = validate_admin_settings(
        current_settings
    )

    if validation_error:
        return jsonify(
            error=validation_error
        ), 400

    if row:
        row.value = current_settings
    else:
        row = SystemSetting(
            key="admin_settings",
            value=current_settings,
        )

        db.session.add(row)

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message="System settings updated",
        settings=current_settings,
    )


# =========================================================
# PICKUP ASSIGNMENT
# =========================================================

@admin_bp.post(
    "/admin/pickups/<int:pickup_id>/assign"
)
@role_required(Role.ADMIN.value)
def assign_pickup(pickup_id):
    pickup = db.session.get(
        PickupRequest,
        pickup_id,
    )

    if not pickup:
        return jsonify(
            error="Pickup request not found"
        ), 404

    if (
        pickup.status
        != PickupStatus.PENDING.value
    ):
        return jsonify(
            error=(
                "Only pending pickups "
                "can be assigned"
            )
        ), 409

    # Payment must be completed before assignment.
    if not pickup.invoice:
        return jsonify(
            error=(
                "This pickup has no invoice. "
                "An invoice must exist before assignment."
            ),
            code="PAYMENT_REQUIRED",
            invoice_status="not invoiced",
        ), 409

    if pickup.invoice.status != PaymentStatus.PAID.value:
        return jsonify(
            error=(
                "Payment is required before this pickup "
                "can be assigned to a collector."
            ),
            code="PAYMENT_REQUIRED",
            invoice_status=pickup.invoice.status,
            invoice_number=pickup.invoice.invoice_number,
        ), 402

    data = request.get_json(
        silent=True
    ) or {}

    collector_id = data.get(
        "collector_id"
    )

    if not collector_id:
        return jsonify(
            error="collector_id is required"
        ), 400

    # IMPORTANT:
    # The frontend sends CollectorProfile.id,
    # not User.id.
    profile = db.session.get(
        CollectorProfile,
        collector_id,
    )

    if not profile:
        return jsonify(
            error="Collector profile not found"
        ), 404

    # Get the actual User connected to this collector profile.
    collector = profile.user

    if not collector:
        return jsonify(
            error="Collector user account not found"
        ), 404

    # Confirm the collector is an approved,
    # active collector.
    if (
        collector.role
        != Role.COLLECTOR.value
        or collector.approval_status
        != ApprovalStatus.APPROVED.value
        or not collector.is_active
    ):
        return jsonify(
            error="Approved collector not found"
        ), 404

    # The vehicle comes automatically from
    # the selected collector's profile.
    vehicle_id = profile.vehicle_id

    if not vehicle_id:
        return jsonify(
            error=(
                "The selected collector "
                "does not have a vehicle assigned"
            )
        ), 409

    vehicle = db.session.get(
        Vehicle,
        vehicle_id,
    )

    if not vehicle:
        return jsonify(
            error="Collector vehicle not found"
        ), 404

    # If the vehicle belongs to this collector,
    # use that vehicle as the assignment vehicle.
    # The admin does not manually choose a vehicle.
    if (
        vehicle.status != "available"
        and vehicle.id != profile.vehicle_id
    ):
        return jsonify(
            error="Selected vehicle is not available"
        ), 409

    pickup.collector_id = collector.id
    pickup.vehicle_id = vehicle.id
    pickup.status = (
        PickupStatus.ASSIGNED.value
    )

    profile.availability_status = "assigned"

    vehicle.status = "assigned"

    notify(
        collector.id,
        "New pickup assigned",
        (
            f"Pickup {pickup.reference} "
            "has been assigned to you."
        ),
    )

    notify(
        pickup.customer_id,
        "Collector assigned",
        (
            "A collector has been assigned "
            f"to pickup {pickup.reference}."
        ),
    )

    result = commit_or_rollback()

    if result:
        return result

    return jsonify(
        message="Pickup assigned",
        pickup=pickup.to_dict(),
    )