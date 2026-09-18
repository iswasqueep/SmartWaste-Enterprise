from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ..extensions import db
from ..models import (
    Address,
    CollectorProfile,
    Invoice,
    PaymentStatus,
    PickupRequest,
    PickupStatus,
    RewardTransaction,
    Role,
    User,
    Vehicle,
    WasteCategory,
    utcnow,
)
from ..services.billing import create_invoice_for_pickup
from ..services.notifications import notify
from ..utils import make_reference, pagination_meta, role_required

pickups_bp = Blueprint("pickups", __name__)


def pickup_is_paid(pickup):
    """A pickup is payable/collectable only when its invoice is paid."""
    return bool(
        pickup.invoice
        and pickup.invoice.status == PaymentStatus.PAID.value
    )


def release_pickup_resources(pickup):
    """Release collector and vehicle when no active pickup uses them."""

    active_statuses = {
        PickupStatus.ASSIGNED.value,
        PickupStatus.ACCEPTED.value,
        PickupStatus.EN_ROUTE.value,
    }

    if pickup.collector_id:
        other_active_pickup = PickupRequest.query.filter(
            PickupRequest.id != pickup.id,
            PickupRequest.collector_id == pickup.collector_id,
            PickupRequest.status.in_(active_statuses),
        ).first()

        if not other_active_pickup:
            profile = CollectorProfile.query.filter_by(
                user_id=pickup.collector_id
            ).first()

            if profile:
                profile.availability_status = "available"

    if pickup.vehicle_id:
        other_active_vehicle = PickupRequest.query.filter(
            PickupRequest.id != pickup.id,
            PickupRequest.vehicle_id == pickup.vehicle_id,
            PickupRequest.status.in_(active_statuses),
        ).first()

        if not other_active_vehicle:
            vehicle = db.session.get(
                Vehicle,
                pickup.vehicle_id,
            )

            if vehicle:
                vehicle.status = "available"


@pickups_bp.post("/pickups")
@jwt_required()
def create_pickup():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    try:
        pickup_date = date.fromisoformat(data.get("pickup_date", ""))
        estimated_weight = float(data.get("estimated_weight", 0))
    except (TypeError, ValueError):
        return jsonify(error="Invalid pickup date or estimated weight"), 400

    if pickup_date < date.today():
        return jsonify(error="Pickup date cannot be in the past"), 400

    if estimated_weight <= 0:
        return jsonify(error="Estimated weight must be greater than zero"), 400

    address = Address.query.filter_by(
        id=data.get("address_id"),
        user_id=user_id
    ).first()

    category = db.session.get(
        WasteCategory,
        data.get("waste_category_id")
    )

    if not address:
        return jsonify(error="Address not found"), 404

    if not category or not category.active:
        return jsonify(error="Waste category not found"), 404

    pickup = PickupRequest(
        reference=make_reference("PU"),
        customer_id=user_id,
        address_id=address.id,
        waste_category_id=category.id,
        pickup_date=pickup_date,
        preferred_time=str(
            data.get("preferred_time", "09:00-12:00")
        ),
        estimated_weight=estimated_weight,
        notes=data.get("notes"),
    )

    try:
        db.session.add(pickup)
        db.session.flush()

        # Invoice is created in the same transaction as the pickup.
        create_invoice_for_pickup(pickup)

        notify(
            user_id,
            "Pickup request created",
            f"Your pickup {pickup.reference} has been created and invoiced.",
        )

        db.session.commit()

    except Exception:
        db.session.rollback()
        return jsonify(error="Unable to create pickup request"), 500

    return jsonify(
        message="Pickup request created",
        pickup=pickup.to_dict(),
    ), 201


@pickups_bp.get("/pickups")
@jwt_required()
def list_pickups():
    identity = int(get_jwt_identity())
    role = get_jwt().get("role")
    page = request.args.get("page", 1, type=int)
    per_page = min(
        request.args.get("per_page", 10, type=int),
        100
    )

    query = PickupRequest.query

    if role == Role.CUSTOMER.value:
        query = query.filter_by(customer_id=identity)

    elif role == Role.COLLECTOR.value:
        query = query.filter_by(collector_id=identity)

    status = request.args.get("status")

    if status:
        query = query.filter_by(status=status)

    pagination = (
        query
        .order_by(PickupRequest.created_at.desc())
        .paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
    )

    return jsonify(
        items=[
            row.to_dict()
            for row in pagination.items
        ],
        meta=pagination_meta(pagination)
    )


@pickups_bp.get("/pickups/<int:pickup_id>")
@jwt_required()
def get_pickup(pickup_id):
    pickup = db.session.get(PickupRequest, pickup_id)

    if not pickup:
        return jsonify(error="Pickup request not found"), 404

    user_id = int(get_jwt_identity())
    role = get_jwt().get("role")

    if (
        role == Role.CUSTOMER.value
        and pickup.customer_id != user_id
    ):
        return jsonify(error="Access denied"), 403

    if (
        role == Role.COLLECTOR.value
        and pickup.collector_id != user_id
    ):
        return jsonify(error="Access denied"), 403

    return jsonify(pickup=pickup.to_dict())


@pickups_bp.patch("/pickups/<int:pickup_id>")
@jwt_required()
@role_required(Role.CUSTOMER.value)
def update_pickup(pickup_id):
    user_id = int(get_jwt_identity())

    pickup = db.session.get(PickupRequest, pickup_id)

    if not pickup:
        return jsonify(error="Pickup request not found"), 404

    if pickup.customer_id != user_id:
        return jsonify(error="Access denied"), 403

    if pickup.status != PickupStatus.PENDING.value:
        return jsonify(error="Only pending pickup requests can be edited"), 400

    data = request.get_json(silent=True) or {}

    address_id = data.get("address_id", pickup.address_id)
    category_id = data.get(
        "waste_category_id",
        pickup.waste_category_id,
    )

    pickup_date_value = data.get(
        "pickup_date",
        pickup.pickup_date.isoformat(),
    )

    try:
        pickup_date = date.fromisoformat(
            str(pickup_date_value)
        )
    except (TypeError, ValueError):
        return jsonify(error="Invalid pickup date"), 400

    preferred_time = str(
        data.get(
            "preferred_time",
            pickup.preferred_time,
        )
        or ""
    ).strip()

    try:
        estimated_weight = float(
            data.get(
                "estimated_weight",
                pickup.estimated_weight,
            )
        )
    except (TypeError, ValueError):
        return jsonify(
            error="Estimated weight must be a valid number"
        ), 400

    if pickup_date < date.today():
        return jsonify(
            error="Pickup date cannot be in the past"
        ), 400

    if not preferred_time:
        return jsonify(
            error="Preferred time is required"
        ), 400

    if estimated_weight <= 0:
        return jsonify(
            error="Estimated weight must be greater than zero"
        ), 400

    address = Address.query.filter_by(
        id=address_id,
        user_id=user_id,
    ).first()

    category = db.session.get(
        WasteCategory,
        category_id,
    )

    if not address:
        return jsonify(
            error="Address not found or does not belong to you"
        ), 404

    if not category or not category.active:
        return jsonify(
            error="Waste category not found or inactive"
        ), 404

    pickup.address_id = address.id
    pickup.waste_category_id = category.id
    pickup.pickup_date = pickup_date
    pickup.preferred_time = preferred_time
    pickup.estimated_weight = estimated_weight
    pickup.notes = str(
        data.get("notes") or ""
    ).strip() or None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(
            error="Unable to update pickup request"
        ), 500

    return jsonify(
        message="Pickup request updated successfully",
        pickup=pickup.to_dict(),
    ), 200


@pickups_bp.delete("/pickups/<int:pickup_id>")
@jwt_required()
@role_required(Role.CUSTOMER.value)
def delete_pickup(pickup_id):
    user_id = int(get_jwt_identity())

    pickup = db.session.get(PickupRequest, pickup_id)

    if not pickup:
        return jsonify(error="Pickup request not found"), 404

    if pickup.customer_id != user_id:
        return jsonify(error="Access denied"), 403

    if pickup.status != PickupStatus.PENDING.value:
        return jsonify(
            error="Only pending pickup requests can be deleted"
        ), 400

    try:
        db.session.delete(pickup)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(
            error="Unable to delete pickup request"
        ), 500

    return jsonify(
        message="Pickup request deleted successfully"
    ), 200


@pickups_bp.patch("/pickups/<int:pickup_id>/status")
@role_required(Role.COLLECTOR.value, Role.ADMIN.value)
def update_status(pickup_id):
    pickup = db.session.get(PickupRequest, pickup_id)

    if not pickup:
        return jsonify(error="Pickup request not found"), 404

    user_id = int(get_jwt_identity())
    role = get_jwt().get("role")

    if (
        role == Role.COLLECTOR.value
        and pickup.collector_id != user_id
    ):
        return jsonify(error="This pickup is not assigned to you"), 403

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    transitions = {
        PickupStatus.ASSIGNED.value: {
            PickupStatus.ACCEPTED.value,
            PickupStatus.CANCELLED.value,
        },
        PickupStatus.ACCEPTED.value: {
            PickupStatus.EN_ROUTE.value,
            PickupStatus.CANCELLED.value,
        },
        PickupStatus.EN_ROUTE.value: {
            PickupStatus.COLLECTED.value,
        },
        PickupStatus.PENDING.value: {
            PickupStatus.ASSIGNED.value,
            PickupStatus.CANCELLED.value,
        },
    }

    if new_status not in transitions.get(pickup.status, set()):
        return jsonify(
            error=f"Invalid transition from {pickup.status} to {new_status}"
        ), 400

    # Hard business-control rule:
    # collectors cannot accept, start, or complete an unpaid pickup.
    if (
        role == Role.COLLECTOR.value
        and new_status in {
            PickupStatus.ACCEPTED.value,
            PickupStatus.EN_ROUTE.value,
            PickupStatus.COLLECTED.value,
        }
        and not pickup_is_paid(pickup)
    ):
        invoice_status = (
            pickup.invoice.status
            if pickup.invoice
            else "not invoiced"
        )

        return jsonify(
            error=(
                "Payment is required before this pickup can proceed. "
                f"Invoice status: {invoice_status}."
            ),
            code="PAYMENT_REQUIRED",
            invoice_status=invoice_status,
        ), 402

    pickup.status = new_status

    if data.get("actual_weight") is not None:
        pickup.actual_weight = float(data["actual_weight"])

    if data.get("evidence_url"):
        pickup.evidence_url = data["evidence_url"]

    if new_status == PickupStatus.COLLECTED.value:
        pickup.completed_at = utcnow()

        if pickup.waste_category.recyclable:
            points = max(
                1,
                int(
                    float(
                        pickup.actual_weight
                        or pickup.estimated_weight
                    ) * 10
                ),
            )

            db.session.add(
                RewardTransaction(
                    user_id=pickup.customer_id,
                    points=points,
                    transaction_type="earned",
                    description=(
                        f"Recycling reward for "
                        f"{pickup.reference}"
                    ),
                )
            )

        release_pickup_resources(pickup)

    notify(
        pickup.customer_id,
        "Pickup status updated",
        f"Pickup {pickup.reference} is now "
        f"{new_status.replace('_', ' ')}."
    )

    db.session.commit()

    return jsonify(
        message="Pickup status updated",
        pickup=pickup.to_dict()
    )