from datetime import date
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func

from ..extensions import db
from ..models import (
    Address,
    Invoice,
    Notification,
    Payment,
    PaymentStatus,
    PickupRequest,
    PickupStatus,
    RewardTransaction,
    Role,
    User,
    WasteCategory,
)
from ..utils import role_required


customer_bp = Blueprint("customer", __name__)


ACTIVE_PICKUP_STATUSES = (
    PickupStatus.PENDING.value,
    PickupStatus.ASSIGNED.value,
    PickupStatus.ACCEPTED.value,
    PickupStatus.EN_ROUTE.value,
)


def current_user_id():
    """Resolve the authenticated user ID from the JWT identity."""

    identity = get_jwt_identity()

    if isinstance(identity, dict):
        identity = (
            identity.get("id")
            or identity.get("user_id")
        )

    try:
        return int(identity)
    except (TypeError, ValueError):
        return None


def get_current_customer():
    """
    Return the authenticated active customer.

    Returns:
        tuple:
            (customer, None) when valid.
            (None, flask_response) when invalid.
    """

    customer_id = current_user_id()

    if not customer_id:
        return None, (
            jsonify(
                error="Invalid authentication identity"
            ),
            401,
        )

    customer = db.session.get(
        User,
        customer_id,
    )

    if not customer:
        return None, (
            jsonify(
                error="Customer account not found"
            ),
            404,
        )

    if customer.role != Role.CUSTOMER.value:
        return None, (
            jsonify(
                error="Customer access required"
            ),
            403,
        )

    if not customer.is_active:
        return None, (
            jsonify(
                error="Customer account is inactive"
            ),
            403,
        )

    return customer, None


# =========================================================
# PUBLIC WASTE CATEGORIES
# =========================================================

@customer_bp.get("/public/waste-categories")
def get_public_waste_categories():
    """
    Return active waste categories for pickup forms.

    This route intentionally does not require authentication so it can also
    be reused by public registration or information pages.
    """

    query = WasteCategory.query

    active_column = getattr(
        WasteCategory,
        "active",
        None,
    )

    if active_column is None:
        active_column = getattr(
            WasteCategory,
            "is_active",
            None,
        )

    if active_column is not None:
        query = query.filter(
            active_column.is_(True)
        )

    categories = (
        query
        .order_by(
            WasteCategory.name.asc()
        )
        .all()
    )

    serialized_categories = []

    for category in categories:
        if hasattr(category, "to_dict"):
            serialized_categories.append(
                category.to_dict()
            )
            continue

        serialized_categories.append(
            {
                "id": category.id,
                "name": category.name,
                "description": getattr(
                    category,
                    "description",
                    None,
                ),
                "recyclable": bool(
                    getattr(
                        category,
                        "recyclable",
                        False,
                    )
                ),
                "active": bool(
                    getattr(
                        category,
                        "active",
                        getattr(
                            category,
                            "is_active",
                            True,
                        ),
                    )
                ),
            }
        )

    return jsonify(
        categories=serialized_categories
    )


# =========================================================
# CUSTOMER PROFILE
# =========================================================

@customer_bp.get("/profile")
@role_required(Role.CUSTOMER.value)
def get_customer_profile():
    """Return the signed-in customer's profile."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    return jsonify(
        user=customer.to_dict()
    )
def normalize_optional_float(value, field_name):
    """Convert an optional coordinate value to float."""

    if value in (None, ""):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(
            f"{field_name} must be a valid number"
        )


def validate_address_payload(data, existing_address=None):
    """Validate and normalize address input."""

    current = existing_address

    label = str(
        data.get(
            "label",
            current.label if current else "Home",
        )
        or "Home"
    ).strip()

    street = str(
        data.get(
            "street",
            current.street if current else "",
        )
        or ""
    ).strip()

    city = str(
        data.get(
            "city",
            current.city if current else "",
        )
        or ""
    ).strip()

    state = str(
        data.get(
            "state",
            current.state if current else "",
        )
        or ""
    ).strip()

    if not street:
        return None, "Street address is required"

    if not city:
        return None, "City is required"

    if not state:
        return None, "State is required"

    if len(label) > 50:
        return None, "Address label cannot exceed 50 characters"

    if len(street) > 255:
        return None, "Street address cannot exceed 255 characters"

    if len(city) > 100:
        return None, "City cannot exceed 100 characters"

    if len(state) > 100:
        return None, "State cannot exceed 100 characters"

    try:
        latitude = normalize_optional_float(
            data.get(
                "latitude",
                current.latitude if current else None,
            ),
            "Latitude",
        )

        longitude = normalize_optional_float(
            data.get(
                "longitude",
                current.longitude if current else None,
            ),
            "Longitude",
        )
    except ValueError as error:
        return None, str(error)

    if latitude is not None and not -90 <= latitude <= 90:
        return None, "Latitude must be between -90 and 90"

    if longitude is not None and not -180 <= longitude <= 180:
        return None, "Longitude must be between -180 and 180"

    return {
        "label": label,
        "street": street,
        "city": city,
        "state": state,
        "latitude": latitude,
        "longitude": longitude,
    }, None


def clear_other_default_addresses(customer_id, excluded_address_id=None):
    """Remove the default flag from a customer's other addresses."""

    query = Address.query.filter(
        Address.user_id == customer_id,
        Address.is_default.is_(True),
    )

    if excluded_address_id is not None:
        query = query.filter(
            Address.id != excluded_address_id
        )

    query.update(
        {"is_default": False},
        synchronize_session=False,
    )


@customer_bp.post("/profile/addresses")
@role_required(Role.CUSTOMER.value)
def create_customer_address():
    """Create a saved pickup address for the signed-in customer."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}

    values, validation_error = validate_address_payload(data)

    if validation_error:
        return jsonify(
            error=validation_error
        ), 400

    existing_count = Address.query.filter_by(
        user_id=customer.id
    ).count()

    requested_default = bool(
        data.get("is_default", False)
    )

    should_be_default = (
        requested_default
        or existing_count == 0
    )

    address = Address(
        user_id=customer.id,
        **values,
        is_default=should_be_default,
    )

    try:
        if should_be_default:
            clear_other_default_addresses(
                customer.id
            )

        db.session.add(address)
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Customer address creation failed"
        )

        return jsonify(
            error="Unable to create address"
        ), 500

    return jsonify(
        message="Address added successfully",
        address=address.to_dict(),
    ), 201


@customer_bp.patch("/profile/addresses/<int:address_id>")
@role_required(Role.CUSTOMER.value)
def update_customer_address(address_id):
    """Update a saved address owned by the signed-in customer."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    address = Address.query.filter_by(
        id=address_id,
        user_id=customer.id,
    ).first()

    if not address:
        return jsonify(
            error="Address not found"
        ), 404

    data = request.get_json(silent=True) or {}

    values, validation_error = validate_address_payload(
        data,
        existing_address=address,
    )

    if validation_error:
        return jsonify(
            error=validation_error
        ), 400

    requested_default = bool(
        data.get(
            "is_default",
            address.is_default,
        )
    )

    for field, value in values.items():
        setattr(address, field, value)

    if requested_default:
        clear_other_default_addresses(
            customer.id,
            excluded_address_id=address.id,
        )
        address.is_default = True

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Customer address update failed"
        )

        return jsonify(
            error="Unable to update address"
        ), 500

    return jsonify(
        message="Address updated successfully",
        address=address.to_dict(),
    )


@customer_bp.delete("/profile/addresses/<int:address_id>")
@role_required(Role.CUSTOMER.value)
def delete_customer_address(address_id):
    """Delete a customer address that is not already used by a pickup."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    address = Address.query.filter_by(
        id=address_id,
        user_id=customer.id,
    ).first()

    if not address:
        return jsonify(
            error="Address not found"
        ), 404

    if address.pickups.count() > 0:
        return jsonify(
            error=(
                "This address cannot be deleted because "
                "it is already linked to a pickup request"
            )
        ), 409

    was_default = address.is_default

    try:
        db.session.delete(address)
        db.session.flush()

        if was_default:
            replacement = (
                Address.query
                .filter(
                    Address.user_id == customer.id,
                    Address.id != address.id,
                )
                .order_by(
                    Address.created_at.asc()
                )
                .first()
            )

            if replacement:
                replacement.is_default = True

        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Customer address deletion failed"
        )

        return jsonify(
            error="Unable to delete address"
        ), 500

    return jsonify(
        message="Address deleted successfully"
    )


@customer_bp.patch(
    "/profile/addresses/<int:address_id>/default"
)
@role_required(Role.CUSTOMER.value)
def set_customer_default_address(address_id):
    """Set one of the signed-in customer's addresses as default."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    address = Address.query.filter_by(
        id=address_id,
        user_id=customer.id,
    ).first()

    if not address:
        return jsonify(
            error="Address not found"
        ), 404

    try:
        clear_other_default_addresses(
            customer.id,
            excluded_address_id=address.id,
        )

        address.is_default = True
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Setting default address failed"
        )

        return jsonify(
            error="Unable to set default address"
        ), 500

    return jsonify(
        message="Default address updated",
        address=address.to_dict(),
    )





@customer_bp.patch("/profile")
@role_required(Role.CUSTOMER.value)
def update_customer_profile():
    """Update the signed-in customer's editable profile fields."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}

    full_name = str(
        data.get(
            "full_name",
            customer.full_name,
        )
    ).strip()

    phone_value = data.get(
        "phone",
        customer.phone,
    )

    phone = (
        str(phone_value).strip()
        if phone_value is not None
        else ""
    )

    if not full_name:
        return jsonify(
            error="Full name is required"
        ), 400

    if len(full_name) < 2:
        return jsonify(
            error=(
                "Full name must contain at least "
                "2 characters"
            )
        ), 400

    if len(full_name) > 120:
        return jsonify(
            error=(
                "Full name cannot exceed "
                "120 characters"
            )
        ), 400

    if len(phone) > 30:
        return jsonify(
            error=(
                "Phone number cannot exceed "
                "30 characters"
            )
        ), 400

    if phone:
        duplicate_phone = (
            User.query
            .filter(
                User.phone == phone,
                User.id != customer.id,
            )
            .first()
        )

        if duplicate_phone:
            return jsonify(
                error=(
                    "Phone number is already "
                    "in use"
                )
            ), 409

    customer.full_name = full_name
    customer.phone = phone or None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Customer profile update failed"
        )

        return jsonify(
            error="Unable to update profile"
        ), 500

    return jsonify(
        message="Profile updated successfully",
        user=customer.to_dict(),
    )


@customer_bp.get("/profile/addresses")
@role_required(Role.CUSTOMER.value)
def get_customer_addresses():
    """Return addresses belonging to the signed-in customer."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    addresses = (
        Address.query
        .filter_by(
            user_id=customer.id
        )
        .order_by(
            Address.is_default.desc(),
            Address.created_at.desc(),
        )
        .all()
    )

    return jsonify(
        addresses=[
            address.to_dict()
            for address in addresses
        ]
    )


def payment_status_values():
    """Return the payment statuses supported by the current model."""

    statuses = {
        PaymentStatus.PENDING.value,
        PaymentStatus.PAID.value,
        PaymentStatus.FAILED.value,
        PaymentStatus.REFUNDED.value,
    }

    if hasattr(PaymentStatus, "CANCELLED"):
        statuses.add(
            PaymentStatus.CANCELLED.value
        )

    return statuses


def customer_payment_summary(customer_id):
    """Return invoice and payment totals for a customer."""

    total_invoices = Invoice.query.filter(
        Invoice.customer_id == customer_id
    ).count()

    pending_invoices = Invoice.query.filter(
        Invoice.customer_id == customer_id,
        Invoice.status == PaymentStatus.PENDING.value,
    ).count()

    paid_invoices = Invoice.query.filter(
        Invoice.customer_id == customer_id,
        Invoice.status == PaymentStatus.PAID.value,
    ).count()

    outstanding_balance = (
        db.session.query(
            func.coalesce(
                func.sum(Invoice.total),
                0,
            )
        )
        .filter(
            Invoice.customer_id == customer_id,
            Invoice.status == PaymentStatus.PENDING.value,
        )
        .scalar()
    )

    total_paid = (
        db.session.query(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .join(
            Invoice,
            Payment.invoice_id == Invoice.id,
        )
        .filter(
            Invoice.customer_id == customer_id,
            Payment.status == PaymentStatus.PAID.value,
        )
        .scalar()
    )

    return {
        "total_invoices": total_invoices,
        "pending_invoices": pending_invoices,
        "paid_invoices": paid_invoices,
        "outstanding_balance": float(
            outstanding_balance or 0
        ),
        "total_paid": float(
            total_paid or 0
        ),
    }


@customer_bp.get("/customer/dashboard")
@role_required(Role.CUSTOMER.value)
def customer_dashboard():
    """Return summary information for the customer dashboard."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    pickups = PickupRequest.query.filter_by(
        customer_id=customer.id,
    )

    active_pickups = pickups.filter(
        PickupRequest.status.in_(
            ACTIVE_PICKUP_STATUSES
        )
    ).count()

    completed_pickups = pickups.filter_by(
        status=PickupStatus.COLLECTED.value,
    ).count()

    cancelled_pickups = pickups.filter_by(
        status=PickupStatus.CANCELLED.value,
    ).count()

    payment_summary = customer_payment_summary(
        customer.id
    )

    reward_points = (
        db.session.query(
            func.coalesce(
                func.sum(RewardTransaction.points),
                0,
            )
        )
        .filter(
            RewardTransaction.user_id == customer.id,
        )
        .scalar()
    )

    recycled_weight = (
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
            PickupRequest.customer_id == customer.id,
            PickupRequest.status
            == PickupStatus.COLLECTED.value,
            WasteCategory.recyclable.is_(True),
        )
        .scalar()
    )

    upcoming_pickup = (
        pickups
        .filter(
            PickupRequest.status.in_(
                ACTIVE_PICKUP_STATUSES
            ),
            PickupRequest.pickup_date >= date.today(),
        )
        .order_by(
            PickupRequest.pickup_date.asc(),
            PickupRequest.created_at.asc(),
        )
        .first()
    )

    if not upcoming_pickup:
        upcoming_pickup = (
            pickups
            .filter(
                PickupRequest.status.in_(
                    ACTIVE_PICKUP_STATUSES
                )
            )
            .order_by(
                PickupRequest.created_at.desc()
            )
            .first()
        )

    recent_pickups = (
        pickups
        .order_by(
            PickupRequest.created_at.desc()
        )
        .limit(6)
        .all()
    )

    notifications = (
        Notification.query
        .filter_by(
            user_id=customer.id,
        )
        .order_by(
            Notification.created_at.desc()
        )
        .limit(6)
        .all()
    )

    unread_notifications = (
        Notification.query
        .filter_by(
            user_id=customer.id,
            read_status=False,
        )
        .count()
    )

    return jsonify(
        customer=customer.to_dict(),
        summary={
            "active_pickups": active_pickups,
            "completed_pickups": completed_pickups,
            "cancelled_pickups": cancelled_pickups,
            "pending_invoices": (
                payment_summary["pending_invoices"]
            ),
            "outstanding_balance": (
                payment_summary["outstanding_balance"]
            ),
            "total_paid": (
                payment_summary["total_paid"]
            ),
            "reward_points": int(
                reward_points or 0
            ),
            "recycled_weight_kg": float(
                recycled_weight or 0
            ),
            "unread_notifications": (
                unread_notifications
            ),
        },
        upcoming_pickup=(
            upcoming_pickup.to_dict()
            if upcoming_pickup
            else None
        ),
        recent_pickups=[
            pickup.to_dict()
            for pickup in recent_pickups
        ],
        notifications=[
            item.to_dict()
            for item in notifications
        ],
        reward_target=500,
    )


@customer_bp.get("/customer/payments")
@role_required(Role.CUSTOMER.value)
def customer_payments():
    """Return only invoices belonging to the signed-in customer."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    status = request.args.get(
        "status",
        type=str,
    )

    allowed_statuses = payment_status_values()

    if status and status not in allowed_statuses:
        return jsonify(
            error="Invalid payment status filter"
        ), 400

    query = Invoice.query.filter(
        Invoice.customer_id == customer.id
    )

    if status:
        query = query.filter(
            Invoice.status == status
        )

    invoices = (
        query
        .order_by(
            Invoice.created_at.desc()
        )
        .all()
    )

    return jsonify(
        summary=customer_payment_summary(
            customer.id
        ),
        invoices=[
            invoice.to_dict()
            for invoice in invoices
        ],
    )


@customer_bp.post(
    "/customer/invoices/<int:invoice_id>/pay"
)
@role_required(Role.CUSTOMER.value)
def start_customer_invoice_payment(invoice_id):
    """Initialize payment for a customer-owned invoice."""

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    invoice = Invoice.query.filter_by(
        id=invoice_id,
        customer_id=customer.id,
    ).first()

    if not invoice:
        return jsonify(
            error="Invoice not found"
        ), 404

    non_payable_statuses = {
        PaymentStatus.PAID.value,
        PaymentStatus.REFUNDED.value,
    }

    if hasattr(PaymentStatus, "CANCELLED"):
        non_payable_statuses.add(
            PaymentStatus.CANCELLED.value
        )

    if invoice.status in non_payable_statuses:
        return jsonify(
            error=(
                "Invoice cannot be paid because "
                f"it is {invoice.status}"
            )
        ), 409

    existing_payment = (
        Payment.query
        .filter_by(
            invoice_id=invoice.id,
            status=PaymentStatus.PENDING.value,
        )
        .order_by(
            Payment.created_at.desc()
        )
        .first()
    )

    if existing_payment:
        if existing_payment.authorization_url:
            return jsonify(
                message="Existing pending payment returned",
                authorization_url=(
                    existing_payment.authorization_url
                ),
                payment=existing_payment.to_dict(),
            )

        db.session.delete(existing_payment)
        db.session.commit()

    transaction_reference = (
        f"SWPAY-{uuid4().hex[:18].upper()}"
    )

    callback_url = (
        current_app.config.get(
            "PAYMENT_CALLBACK_URL"
        )
        or current_app.config.get(
            "PAYSTACK_CALLBACK_URL"
        )
        or "http://localhost:5173/payments/verify"
    )

    separator = (
        "&"
        if "?" in callback_url
        else "?"
    )

    authorization_url = (
        f"{callback_url}"
        f"{separator}reference={transaction_reference}"
    )

    payment = Payment(
        invoice_id=invoice.id,
        transaction_reference=transaction_reference,
        provider=current_app.config.get(
            "PAYMENT_PROVIDER",
            "demo",
        ),
        amount=invoice.total,
        currency="NGN",
        payment_method="online",
        status=PaymentStatus.PENDING.value,
        authorization_url=authorization_url,
    )

    try:
        db.session.add(payment)
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Customer payment initialization failed"
        )

        return jsonify(
            error="Unable to initialize payment"
        ), 500

    return jsonify(
        message="Payment initialized",
        authorization_url=authorization_url,
        payment=payment.to_dict(),
    ), 201


# =========================================================
# CUSTOMER REWARDS
# =========================================================

REWARD_LEVELS = (
    {"name": "Bronze", "minimum_points": 0, "next_level": "Silver", "next_threshold": 100},
    {"name": "Silver", "minimum_points": 100, "next_level": "Gold", "next_threshold": 500},
    {"name": "Gold", "minimum_points": 500, "next_level": "Platinum", "next_threshold": 1000},
    {"name": "Platinum", "minimum_points": 1000, "next_level": None, "next_threshold": None},
)

CARBON_SAVED_PER_RECYCLED_KG = 0.42


def calculate_reward_level(points):
    """Return the customer's current reward level and progress."""

    safe_points = max(int(points or 0), 0)
    current_level = REWARD_LEVELS[0]

    for level in REWARD_LEVELS:
        if safe_points >= level["minimum_points"]:
            current_level = level
        else:
            break

    next_level = current_level["next_level"]
    next_threshold = current_level["next_threshold"]

    if next_level is None or next_threshold is None:
        return {
            "current_level": current_level["name"],
            "next_level": None,
            "points_to_next": 0,
            "progress": 100,
        }

    current_threshold = current_level["minimum_points"]
    level_range = next_threshold - current_threshold
    points_in_level = safe_points - current_threshold
    progress = round(points_in_level / level_range * 100, 1) if level_range > 0 else 100

    return {
        "current_level": current_level["name"],
        "next_level": next_level,
        "points_to_next": max(next_threshold - safe_points, 0),
        "progress": min(max(progress, 0), 100),
    }


def build_reward_achievements(reward_points, recycled_weight, completed_pickups):
    """Build achievement progress from live customer activity."""

    definitions = (
        {
            "id": "first-pickup",
            "title": "First Pickup",
            "description": "Complete your first successful waste collection.",
            "metric": "pickups",
            "current": completed_pickups,
            "target": 1,
            "icon": "PackageCheck",
        },
        {
            "id": "five-pickups",
            "title": "Waste Warrior",
            "description": "Complete at least five successful pickups.",
            "metric": "pickups",
            "current": completed_pickups,
            "target": 5,
            "icon": "Trophy",
        },
        {
            "id": "recycle-fifty",
            "title": "Recycling Starter",
            "description": "Recycle at least 50 kg of recyclable waste.",
            "metric": "weight",
            "current": recycled_weight,
            "target": 50,
            "icon": "Recycle",
        },
        {
            "id": "five-hundred-points",
            "title": "Green Champion",
            "description": "Accumulate at least 500 reward points.",
            "metric": "points",
            "current": reward_points,
            "target": 500,
            "icon": "Award",
        },
    )

    achievements = []

    for item in definitions:
        current_value = float(item["current"] or 0)
        target_value = float(item["target"])
        percentage = min(round(current_value / target_value * 100, 1), 100)

        achievements.append({
            "id": item["id"],
            "title": item["title"],
            "description": item["description"],
            "metric": item["metric"],
            "icon": item["icon"],
            "unlocked": current_value >= target_value,
            "progress": current_value,
            "progress_percentage": percentage,
            "target": item["target"],
        })

    return achievements


def serialize_reward_transaction(transaction):
    """Return a stable transaction shape for the React rewards page."""

    if hasattr(transaction, "to_dict"):
        data = transaction.to_dict()
    else:
        data = {
            "id": getattr(transaction, "id", None),
            "user_id": getattr(transaction, "user_id", None),
            "points": getattr(transaction, "points", 0),
            "created_at": (
                transaction.created_at.isoformat()
                if getattr(transaction, "created_at", None)
                else None
            ),
        }

    points = int(data.get("points") or 0)
    data.setdefault(
        "description",
        getattr(
            transaction,
            "description",
            "Reward points earned" if points >= 0 else "Reward points redeemed",
        ),
    )
    data.setdefault(
        "transaction_type",
        getattr(
            transaction,
            "transaction_type",
            "earned" if points >= 0 else "redeemed",
        ),
    )

    pickup = getattr(transaction, "pickup", None)
    data.setdefault("pickup_reference", getattr(pickup, "reference", None))

    return data


@customer_bp.get("/customer/rewards")
@role_required(Role.CUSTOMER.value)
def customer_rewards():
    """
    Return reward statistics, achievements and transaction history.

    All values come from the authenticated customer's live PostgreSQL data.
    Legacy top-level fields are retained for older frontend code.
    """

    customer, error_response = get_current_customer()

    if error_response:
        return error_response

    reward_points = (
        db.session.query(func.coalesce(func.sum(RewardTransaction.points), 0))
        .filter(RewardTransaction.user_id == customer.id)
        .scalar()
    )
    reward_points = int(reward_points or 0)

    completed_pickups = (
        PickupRequest.query
        .filter(
            PickupRequest.customer_id == customer.id,
            PickupRequest.status == PickupStatus.COLLECTED.value,
        )
        .count()
    )

    completed_recyclable_pickups = (
        PickupRequest.query
        .join(WasteCategory, PickupRequest.waste_category_id == WasteCategory.id)
        .filter(
            PickupRequest.customer_id == customer.id,
            PickupRequest.status == PickupStatus.COLLECTED.value,
            WasteCategory.recyclable.is_(True),
        )
        .count()
    )

    recycled_weight = (
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
        .join(WasteCategory, PickupRequest.waste_category_id == WasteCategory.id)
        .filter(
            PickupRequest.customer_id == customer.id,
            PickupRequest.status == PickupStatus.COLLECTED.value,
            WasteCategory.recyclable.is_(True),
        )
        .scalar()
    )
    recycled_weight = float(recycled_weight or 0)

    carbon_saved = round(recycled_weight * CARBON_SAVED_PER_RECYCLED_KG, 2)
    level_data = calculate_reward_level(reward_points)

    transactions = (
        RewardTransaction.query
        .filter_by(user_id=customer.id)
        .order_by(RewardTransaction.created_at.desc())
        .limit(50)
        .all()
    )

    serialized_transactions = [serialize_reward_transaction(item) for item in transactions]

    achievements = build_reward_achievements(
        reward_points=reward_points,
        recycled_weight=recycled_weight,
        completed_pickups=completed_pickups,
    )

    summary = {
        "reward_points": reward_points,
        "recycled_weight_kg": recycled_weight,
        "completed_pickups": completed_pickups,
        "completed_recyclable_pickups": completed_recyclable_pickups,
        "carbon_saved_kg": carbon_saved,
        **level_data,
    }

    return jsonify(
        summary=summary,
        achievements=achievements,
        transactions=serialized_transactions,
        points=reward_points,
        reward_points=reward_points,
        recycled_weight_kg=recycled_weight,
        completed_pickups=completed_pickups,
        completed_recyclable_pickups=completed_recyclable_pickups,
        carbon_saved_kg=carbon_saved,
    )