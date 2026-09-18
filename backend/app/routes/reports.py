from datetime import date, timedelta

from flask import Blueprint, jsonify
from sqlalchemy import func

from ..extensions import db
from ..models import Invoice, PaymentStatus, PickupRequest, PickupStatus, Role, WasteCategory
from ..utils import role_required

reports_bp = Blueprint("reports", __name__)


@reports_bp.get("/reports/dashboard")
@role_required(Role.ADMIN.value, Role.GOVERNMENT.value)
def dashboard_report():
    today = date.today()
    month_start = today.replace(day=1)
    total_pickups = PickupRequest.query.count()
    completed = PickupRequest.query.filter_by(status=PickupStatus.COLLECTED.value).count()
    pending = PickupRequest.query.filter(PickupRequest.status.in_([PickupStatus.PENDING.value, PickupStatus.ASSIGNED.value])).count()
    revenue = db.session.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.status == PaymentStatus.PAID.value, Invoice.created_at >= month_start).scalar()
    waste_rows = db.session.query(WasteCategory.name, func.coalesce(func.sum(PickupRequest.actual_weight), func.sum(PickupRequest.estimated_weight), 0)).join(PickupRequest).group_by(WasteCategory.name).all()
    return jsonify(
        summary={
            "total_pickups": total_pickups,
            "completed_pickups": completed,
            "pending_pickups": pending,
            "completion_rate": round((completed / total_pickups * 100), 2) if total_pickups else 0,
            "monthly_revenue": float(revenue or 0),
        },
        waste_distribution=[{"category": name, "weight_kg": float(weight or 0)} for name, weight in waste_rows],
    )
