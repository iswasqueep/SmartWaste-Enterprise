from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import (
    User,
    PickupRequest,
    PickupStatus,
    CollectorProfile,
    Role,
    Vehicle,
)
from ..utils import role_required

collector_bp = Blueprint("collector", __name__)


def current_user():
    identity = get_jwt_identity()
    return db.session.get(User, int(identity))


def get_collector_pickup(user_id, pickup_id):
    return PickupRequest.query.filter_by(
        id=pickup_id,
        collector_id=user_id,
    ).first_or_404(description="Pickup not found or not assigned to this collector.")


# --------------------------------------------------------------------------
# Dashboard Stats & Availability
# --------------------------------------------------------------------------

@collector_bp.get("/collector/dashboard")
@jwt_required()
@role_required(Role.COLLECTOR.value)
def dashboard():
    user = current_user()

    profile = CollectorProfile.query.filter_by(user_id=user.id).first_or_404()

    assigned = PickupRequest.query.filter_by(
        collector_id=user.id,
        status=PickupStatus.ASSIGNED.value,
    ).count()

    accepted = PickupRequest.query.filter_by(
        collector_id=user.id,
        status=PickupStatus.ACCEPTED.value,
    ).count()

    en_route = PickupRequest.query.filter_by(
        collector_id=user.id,
        status=PickupStatus.EN_ROUTE.value,
    ).count()

    completed = PickupRequest.query.filter_by(
        collector_id=user.id,
        status=PickupStatus.COLLECTED.value,
    ).count()

    return jsonify({
        "assigned": assigned,
        "accepted": accepted,
        "en_route": en_route,
        "completed": completed,
        "availability": profile.availability_status,
        "rating": float(profile.rating or 0),
        "collector_code": profile.collector_code,
    }), 200


@collector_bp.route("/collector/availability", methods=["PUT", "PATCH"])
@jwt_required()
@role_required(Role.COLLECTOR.value)
def update_availability():
    user = current_user()

    profile = CollectorProfile.query.filter_by(user_id=user.id).first_or_404()
    data = request.get_json(silent=True) or {}
    status = data.get("availability_status")

    if status not in ["available", "unavailable"]:
        return jsonify(error="Invalid availability status."), 400

    profile.availability_status = status
    db.session.commit()

    return jsonify({
        "message": "Availability updated.",
        "availability_status": profile.availability_status,
    }), 200


# --------------------------------------------------------------------------
# Pickup Queries
# --------------------------------------------------------------------------

@collector_bp.get("/collector/pickups")
@jwt_required()
@role_required(Role.COLLECTOR.value)
def assigned_pickups():
    user = current_user()

    pickups = (
        PickupRequest.query
        .options(
            joinedload(PickupRequest.customer),
            joinedload(PickupRequest.address),
            joinedload(PickupRequest.waste_category),
            joinedload(PickupRequest.collector),
            joinedload(PickupRequest.vehicle),
            joinedload(PickupRequest.invoice),
        )
        .filter(PickupRequest.collector_id == user.id)
        .order_by(PickupRequest.created_at.desc())
        .all()
    )

    return jsonify([
        pickup.to_dict()
        for pickup in pickups
    ]), 200

@collector_bp.get("/collector/pickups/<int:pickup_id>")
@jwt_required()
@role_required(Role.COLLECTOR.value)
def pickup_details(pickup_id):
    user = current_user()
    pickup = get_collector_pickup(user.id, pickup_id)
    
    return jsonify(pickup.to_dict() if hasattr(pickup, "to_dict") else {
        "id": pickup.id,
        "reference": getattr(pickup, "reference", f"#{pickup.id}"),
        "status": pickup.status,
    }), 200


# --------------------------------------------------------------------------
# Pickup Status Lifecycle Transitions (Accept, Reject, Start, Complete)
# --------------------------------------------------------------------------

# 1. Accept Pickup
@collector_bp.route("/collector/pickups/<int:pickup_id>/accept", methods=["PUT", "PATCH"])
@jwt_required()
@role_required(Role.COLLECTOR.value)
def accept_pickup(pickup_id):
    user = current_user()
    pickup = get_collector_pickup(user.id, pickup_id)

    if pickup.status not in [PickupStatus.ASSIGNED.value, "pending"]:
        return jsonify(error="Only assigned pickups can be accepted."), 400

    pickup.status = PickupStatus.ACCEPTED.value
    db.session.commit()

    return jsonify({
        "message": "Pickup accepted successfully.",
        "pickup": pickup.to_dict() if hasattr(pickup, "to_dict") else {"id": pickup.id, "status": pickup.status},
    }), 200


# 2. Reject / Decline Pickup
@collector_bp.route("/collector/pickups/<int:pickup_id>/reject", methods=["PUT", "PATCH"])
@jwt_required()
@role_required(Role.COLLECTOR.value)
def reject_pickup(pickup_id):
    user = current_user()
    pickup = get_collector_pickup(user.id, pickup_id)

    if pickup.status not in [PickupStatus.ASSIGNED.value, "pending"]:
        return jsonify(error="Only pending or assigned pickups can be rejected."), 400

    # Unassign collector and return status to pending/cancelled
    pickup.collector_id = None
    pickup.status = getattr(PickupStatus, "CANCELLED", PickupStatus.ASSIGNED).value

    db.session.commit()

    return jsonify({
        "message": "Pickup rejected successfully.",
    }), 200


# 3. Start Route / En-Route
@collector_bp.route("/collector/pickups/<int:pickup_id>/start", methods=["PUT", "PATCH"])
@jwt_required()
@role_required(Role.COLLECTOR.value)
def start_pickup(pickup_id):
    user = current_user()
    pickup = get_collector_pickup(user.id, pickup_id)

    if pickup.status != PickupStatus.ACCEPTED.value:
        return jsonify(error="Pickup must be accepted before starting route."), 400

    pickup.status = PickupStatus.EN_ROUTE.value
    db.session.commit()

    return jsonify({
        "message": "Journey started successfully.",
        "pickup": pickup.to_dict() if hasattr(pickup, "to_dict") else {"id": pickup.id, "status": pickup.status},
    }), 200


# 4. Complete / Mark Collected
@collector_bp.route("/collector/pickups/<int:pickup_id>/complete", methods=["PUT", "PATCH"])
@jwt_required()
@role_required(Role.COLLECTOR.value)
def complete_pickup(pickup_id):
    user = current_user()
    pickup = get_collector_pickup(user.id, pickup_id)

    if pickup.status != PickupStatus.EN_ROUTE.value:
        return jsonify(error="Pickup must be en-route to mark as completed."), 400

    data = request.get_json(silent=True) or {}

    pickup.actual_weight = data.get("actual_weight", getattr(pickup, "actual_weight", None))
    pickup.collector_note = data.get("collector_note", getattr(pickup, "collector_note", None))
    pickup.completed_at = datetime.utcnow()
    pickup.status = PickupStatus.COLLECTED.value

    db.session.commit()

    return jsonify({
        "message": "Pickup completed successfully.",
        "pickup": pickup.to_dict() if hasattr(pickup, "to_dict") else {"id": pickup.id, "status": pickup.status},
    }), 200