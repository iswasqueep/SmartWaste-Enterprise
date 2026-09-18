from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt

from ..extensions import db
from ..models import (
    PickupRequest,
    PickupStatus,
    RecyclingBatch,
    RecyclingCompanyProfile,
    Role,
    WasteCategory,
)
from ..utils import get_current_user_id, role_required


recycling_bp = Blueprint("recycling", __name__)


# ============================================================
# RECYCLING COMPANY WASTE-TYPE HELPERS
# ============================================================

import json


def get_recycling_company_profile(user_id):
    """
    Return the recycling company profile belonging
    to the authenticated user.
    """
    return (
        RecyclingCompanyProfile.query
        .filter_by(user_id=user_id)
        .first()
    )


def normalize_waste_type(value):
    """
    Normalize a waste type so comparisons are reliable.

    Examples:
        "Glass"        -> "glass"
        " GLASS "      -> "glass"
        "Glass Waste"  -> "glass waste"
    """
    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
    )


def get_accepted_waste_types(profile):
    """
    Read accepted_waste_types from the recycling company
    profile.

    Supports:

        Glass, Paper, Plastic

    and:

        glass,paper,plastic

    and JSON:

        ["Glass", "Paper", "Plastic"]

    and:

        ["glass", "paper", "plastic"]

    Empty/null means no restriction has been configured.
    """

    if not profile:
        return []

    raw_value = profile.accepted_waste_types

    if raw_value is None:
        return []

    raw_value = str(raw_value).strip()

    if not raw_value:
        return []

    # --------------------------------------------------------
    # Try JSON first
    # --------------------------------------------------------

    if raw_value.startswith("[") and raw_value.endswith("]"):

        try:
            parsed = json.loads(raw_value)

            if isinstance(parsed, list):
                return [
                    normalize_waste_type(item)
                    for item in parsed
                    if normalize_waste_type(item)
                ]

        except (json.JSONDecodeError, TypeError):
            pass

    # --------------------------------------------------------
    # Support common separators
    # --------------------------------------------------------

    raw_value = (
        raw_value
        .replace("|", ",")
        .replace(";", ",")
    )

    accepted_types = []

    for item in raw_value.split(","):

        normalized = normalize_waste_type(item)

        if normalized:
            accepted_types.append(normalized)

    return accepted_types


def company_accepts_category(profile, category):
    """
    Determine whether a recycling company can receive
    a particular recyclable waste category.

    Rules:

    1. No company profile -> False
    2. Empty accepted_waste_types -> accept all recyclable
       categories.
    3. "all" / "*" -> accept all recyclable categories.
    4. Otherwise compare normalized category names.
    """

    if not profile:
        return False

    if not category:
        return False

    accepted_types = get_accepted_waste_types(profile)

    # --------------------------------------------------------
    # No restriction configured
    # --------------------------------------------------------

    if not accepted_types:
        return bool(category.recyclable)

    # --------------------------------------------------------
    # Explicit "all"
    # --------------------------------------------------------

    if "all" in accepted_types or "*" in accepted_types:
        return bool(category.recyclable)

    # --------------------------------------------------------
    # Normalize category
    # --------------------------------------------------------

    category_name = normalize_waste_type(
        category.name
    )

    # --------------------------------------------------------
    # Exact match
    # --------------------------------------------------------

    if category_name in accepted_types:
        return True

    # --------------------------------------------------------
    # Handle common naming differences
    #
    # Example:
    #   Database category = "Glass"
    #   Company setting   = "Glass Waste"
    # --------------------------------------------------------

    for accepted in accepted_types:

        if (
            category_name == accepted
            or category_name in accepted
            or accepted in category_name
        ):
            return True

    return False


def get_pickup_weight(pickup):
    """
    Determine the best available pickup weight.
    """

    return float(
        pickup.actual_weight
        or pickup.estimated_weight
        or 0
    )


def batch_to_dict(batch):
    """
    Return a consistent recycling batch response.
    """

    data = batch.to_dict()

    data.update(
        {
            "pickup_reference": (
                batch.pickup.reference
                if batch.pickup
                else None
            ),

            "customer_name": (
                batch.pickup.customer.full_name
                if batch.pickup
                and batch.pickup.customer
                else None
            ),

            "waste_category": (
                batch.waste_category.name
                if batch.waste_category
                else None
            ),

            "recycling_company_id": (
                batch.recycling_company_id
            ),
        }
    )

    return data


# ============================================================
# RECYCLING DASHBOARD
# ============================================================

@recycling_bp.get("/recycling/dashboard")
@role_required(
    Role.ADMIN.value,
    Role.RECYCLING_COMPANY.value,
    Role.GOVERNMENT.value,
)
def recycling_dashboard():

    claims = get_jwt()

    user_role = claims.get("role")

    current_user_id = get_current_user_id()

    # --------------------------------------------------------
    # Recyclable categories
    # --------------------------------------------------------

    recyclable_categories = (
        WasteCategory.query
        .filter_by(
            recyclable=True,
            active=True,
        )
        .all()
    )

    # --------------------------------------------------------
    # Recycling batches
    # --------------------------------------------------------

    batch_query = RecyclingBatch.query

    if user_role == Role.RECYCLING_COMPANY.value:

        batch_query = (
            batch_query
            .filter_by(
                recycling_company_id=current_user_id
            )
        )

    batches = (
        batch_query
        .order_by(
            RecyclingBatch.created_at.desc()
        )
        .all()
    )

    # --------------------------------------------------------
    # Batch statistics
    # --------------------------------------------------------

    total_received_kg = sum(
        float(batch.weight_received or 0)
        for batch in batches
    )

    total_processed_kg = sum(
        float(batch.weight_processed or 0)
        for batch in batches
    )

    pending_processing_kg = sum(
        float(batch.weight_received or 0)
        for batch in batches
        if batch.status in {
            "received",
            "processing",
        }
    )

    processing_batches = sum(
        1
        for batch in batches
        if batch.status == "processing"
    )

    received_batches = sum(
        1
        for batch in batches
        if batch.status == "received"
    )

    completed_batches = sum(
        1
        for batch in batches
        if batch.status == "processed"
    )

    rejected_batches = sum(
        1
        for batch in batches
        if batch.status == "rejected"
    )

    

    incoming_query = (
        PickupRequest.query
        .join(WasteCategory)
        .filter(
            PickupRequest.status
            == PickupStatus.COLLECTED.value,

            WasteCategory.recyclable.is_(True),
        )
        .order_by(
            PickupRequest.completed_at.desc()
        )
    )

    collected_pickups = (
        incoming_query
        .all()
    )

    incoming_count = 0
    incoming_weight_kg = 0

    for pickup in collected_pickups:

        existing_batch = (
            RecyclingBatch.query
            .filter_by(
                pickup_id=pickup.id
            )
            .first()
        )

        if existing_batch:
            continue

        incoming_count += 1

        incoming_weight_kg += (
            get_pickup_weight(pickup)
        )

    # --------------------------------------------------------
    # Recovery rate
    # --------------------------------------------------------

    recovery_rate = 0

    if total_received_kg > 0:

        recovery_rate = (
            total_processed_kg
            / total_received_kg
        ) * 100

    return jsonify(
        {
            "total_categories": len(
                recyclable_categories
            ),

            "total_received_kg": round(
                total_received_kg,
                2,
            ),

            "total_processed_kg": round(
                total_processed_kg,
                2,
            ),

            "pending_processing_kg": round(
                pending_processing_kg,
                2,
            ),

            "incoming_count": incoming_count,

            "incoming_weight_kg": round(
                incoming_weight_kg,
                2,
            ),

            "total_batches": len(
                batches
            ),

            "received_batches": (
                received_batches
            ),

            "processing_batches": (
                processing_batches
            ),

            "completed_batches": (
                completed_batches
            ),

            "rejected_batches": (
                rejected_batches
            ),

            "recovery_rate": round(
                recovery_rate,
                2,
            ),
        }
    ), 200


# ============================================================
# INCOMING RECYCLABLE MATERIAL
# ============================================================

@recycling_bp.get("/recycling/incoming")
@role_required(
    Role.ADMIN.value,
    Role.RECYCLING_COMPANY.value,
    Role.GOVERNMENT.value,
)
def get_incoming_recyclables():


    # --------------------------------------------------------
    # Find collected recyclable pickups
    # --------------------------------------------------------

    pickups = (
        PickupRequest.query
        .join(WasteCategory)
        .filter(
            PickupRequest.status
            == PickupStatus.COLLECTED.value,

            WasteCategory.recyclable.is_(True),
        )
        .order_by(
            PickupRequest.completed_at.desc()
        )
        .all()
    )

    items = []

    for pickup in pickups:

        # ----------------------------------------------------
        # Skip already received pickups
        # ----------------------------------------------------

        existing_batch = (
            RecyclingBatch.query
            .filter_by(
                pickup_id=pickup.id
            )
            .first()
        )

        if existing_batch:
            continue

        # ----------------------------------------------------
        # Determine weight
        # ----------------------------------------------------

        weight = float(
            pickup.actual_weight
            or pickup.estimated_weight
            or 0
        )

        # ----------------------------------------------------
        # Add incoming item
        # ----------------------------------------------------

        items.append(
            {
                "pickup_id": pickup.id,

                "reference": pickup.reference,

                "customer": (
                    pickup.customer.full_name
                    if pickup.customer
                    else None
                ),

                "waste_category": (
                    pickup.waste_category.name
                    if pickup.waste_category
                    else None
                ),

                "estimated_weight": float(
                    pickup.estimated_weight
                    or 0
                ),

                "actual_weight": (
                    float(
                        pickup.actual_weight
                    )
                    if pickup.actual_weight
                    is not None
                    else None
                ),

                "weight": weight,

                "completed_at": (
                    pickup.completed_at.isoformat()
                    if pickup.completed_at
                    else None
                ),

                "status": pickup.status,
            }
        )

    return jsonify(
        {
            "items": items,
            "total": len(items),
        }
    ), 200


# ============================================================
# LIST RECYCLING BATCHES
# ============================================================

@recycling_bp.get("/recycling/batches")
@role_required(
    Role.ADMIN.value,
    Role.RECYCLING_COMPANY.value,
    Role.GOVERNMENT.value,
)
def list_recycling_batches():

    claims = get_jwt()

    user_role = claims.get("role")

    current_user_id = get_current_user_id()

    query = RecyclingBatch.query

    # --------------------------------------------------------
    # Recycling companies only see their own batches.
    # --------------------------------------------------------

    if user_role == Role.RECYCLING_COMPANY.value:

        query = (
            query
            .filter_by(
                recycling_company_id=current_user_id
            )
        )

    batches = (
        query
        .order_by(
            RecyclingBatch.created_at.desc()
        )
        .all()
    )

    return jsonify(
        {
            "items": [
                batch_to_dict(batch)
                for batch in batches
            ],

            "total": len(batches),
        }
    ), 200

@recycling_bp.post("/recycling/batches")
@role_required(
    Role.ADMIN.value,
    Role.RECYCLING_COMPANY.value,
)
def create_recycling_batch():

    claims = get_jwt()

    user_role = claims.get("role")
    current_user_id = get_current_user_id()

    if not current_user_id:
        return jsonify(
            error="Invalid authentication identity"
        ), 401

    # --------------------------------------------------------
    # REQUEST DATA
    # --------------------------------------------------------

    data = request.get_json(silent=True) or {}

    pickup_id = data.get("pickup_id")

    if not pickup_id:
        return jsonify(
            error="pickup_id is required"
        ), 400

    # --------------------------------------------------------
    # FIND PICKUP
    # --------------------------------------------------------

    pickup = db.session.get(
        PickupRequest,
        pickup_id
    )

    if not pickup:
        return jsonify(
            error="Pickup not found"
        ), 404

    # --------------------------------------------------------
    # PICKUP MUST BE COLLECTED
    # --------------------------------------------------------

    if pickup.status != PickupStatus.COLLECTED.value:
        return jsonify(
            error=(
                "Only collected pickups can "
                "be received for recycling."
            )
        ), 400

    # --------------------------------------------------------
    # WASTE CATEGORY
    # --------------------------------------------------------

    category = pickup.waste_category

    if not category:
        return jsonify(
            error="Pickup has no waste category"
        ), 400

    # --------------------------------------------------------
    # MUST BE RECYCLABLE
    # --------------------------------------------------------

    if not category.recyclable:
        return jsonify(
            error="This waste category is not recyclable."
        ), 400

    # --------------------------------------------------------
    # PREVENT DUPLICATE RECEIPT
    # --------------------------------------------------------

    existing_batch = (
        RecyclingBatch.query
        .filter_by(
            pickup_id=pickup.id
        )
        .first()
    )

    if existing_batch:
        return jsonify(
            {
                "error": (
                    "This pickup has already "
                    "been received into recycling."
                ),
                "batch": batch_to_dict(
                    existing_batch
                ),
            }
        ), 409

    # ========================================================
    # DETERMINE RECYCLING COMPANY
    # ========================================================

    company_profile = None
    recycling_company_id = None

    # --------------------------------------------------------
    # RECYCLING COMPANY USER
    # --------------------------------------------------------

    if user_role == Role.RECYCLING_COMPANY.value:

        company_profile = (
            get_recycling_company_profile(
                current_user_id
            )
        )

        if not company_profile:
            return jsonify(
                error=(
                    "Recycling company profile "
                    "not found for the authenticated user."
                )
            ), 404

        recycling_company_id = current_user_id

        # ----------------------------------------------------
        # Company must accept this waste type
        # ----------------------------------------------------

        if not company_accepts_category(
            company_profile,
            category
        ):
            return jsonify(
                {
                    "error": (
                        "Your recycling company does not "
                        "accept this waste type."
                    ),
                    "waste_type": category.name,
                    "accepted_waste_types":
                        get_accepted_waste_types(
                            company_profile
                        ),
                }
            ), 403

    # ========================================================
    # ADMINISTRATOR
    # ========================================================

    elif user_role == Role.ADMIN.value:

        # ----------------------------------------------------
        # Admin can optionally provide a company ID.
        #
        # If no company ID is supplied, automatically find
        # a recycling company that accepts the waste type.
        # ----------------------------------------------------

        requested_company_id = data.get(
            "recycling_company_id"
        )

        if requested_company_id:

            try:
                requested_company_id = int(
                    requested_company_id
                )
            except (
                TypeError,
                ValueError,
            ):
                return jsonify(
                    error=(
                        "recycling_company_id "
                        "must be a valid integer."
                    )
                ), 400

            company_profile = (
                get_recycling_company_profile(
                    requested_company_id
                )
            )

            if not company_profile:
                return jsonify(
                    error=(
                        "The selected recycling "
                        "company was not found."
                    )
                ), 404

            recycling_company_id = (
                requested_company_id
            )

            # ------------------------------------------------
            # Verify selected company accepts material
            # ------------------------------------------------

            if not company_accepts_category(
                company_profile,
                category
            ):
                return jsonify(
                    {
                        "error": (
                            "The selected recycling company "
                            "does not accept this waste type."
                        ),
                        "waste_type": category.name,
                        "accepted_waste_types":
                            get_accepted_waste_types(
                                company_profile
                            ),
                    }
                ), 403

        else:

            # ------------------------------------------------
            # Automatically find a company that accepts
            # this recyclable category.
            # ------------------------------------------------

            profiles = (
                RecyclingCompanyProfile.query
                .all()
            )

            for profile in profiles:

                if company_accepts_category(
                    profile,
                    category
                ):

                    company_profile = profile

                    recycling_company_id = (
                        profile.user_id
                    )

                    break

            # ------------------------------------------------
            # No suitable company found
            # ------------------------------------------------

            if not recycling_company_id:

                return jsonify(
                    {
                        "error": (
                            "No recycling company is "
                            "configured to accept this "
                            "waste type."
                        ),
                        "waste_type": category.name,
                    }
                ), 422

    # --------------------------------------------------------
    # Unexpected role
    # --------------------------------------------------------

    else:

        return jsonify(
            error="You are not authorized to receive recyclable material."
        ), 403

    # ========================================================
    # WEIGHT
    # ========================================================

    weight_received = data.get(
        "weight_received"
    )

    if weight_received is None:

        weight_received = (
            pickup.actual_weight
            or pickup.estimated_weight
        )

    try:

        weight_received = float(
            weight_received
        )

    except (
        TypeError,
        ValueError,
    ):

        return jsonify(
            error=(
                "weight_received must "
                "be a valid number."
            )
        ), 400

    if weight_received <= 0:

        return jsonify(
            error=(
                "weight_received must "
                "be greater than zero."
            )
        ), 400

    # ========================================================
    # NOTES
    # ========================================================

    notes = (
        str(
            data.get("notes") or ""
        )
        .strip()
        or None
    )

    # ========================================================
    # CREATE BATCH
    # ========================================================

    batch = RecyclingBatch(
        pickup_id=pickup.id,

        recycling_company_id=(
            recycling_company_id
        ),

        waste_category_id=(
            pickup.waste_category_id
        ),

        weight_received=(
            weight_received
        ),

        status="received",

        notes=notes,
    )

    try:

        db.session.add(batch)

        db.session.commit()

    except Exception as exc:

        db.session.rollback()

        current_app.logger.exception(
            "Failed to create recycling batch"
        )

        return jsonify(
            error=(
                "Failed to receive recyclable "
                f"waste: {exc}"
            )
        ), 500

    return jsonify(
        {
            "message": (
                "Waste received for recycling."
            ),

            "batch": batch_to_dict(
                batch
            ),
        }
    ), 201


# ============================================================
# UPDATE RECYCLING BATCH
# ============================================================

@recycling_bp.patch(
    "/recycling/batches/<int:batch_id>"
)
@role_required(
    Role.ADMIN.value,
    Role.RECYCLING_COMPANY.value,
)
def update_recycling_batch(
    batch_id
):

    claims = get_jwt()

    user_role = claims.get("role")

    current_user_id = get_current_user_id()

    # --------------------------------------------------------
    # Find batch
    # --------------------------------------------------------

    batch = db.session.get(
        RecyclingBatch,
        batch_id,
    )

    if not batch:

        return jsonify(
            error="Recycling batch not found"
        ), 404

    # --------------------------------------------------------
    # Ownership protection
    # --------------------------------------------------------

    if (
        user_role
        == Role.RECYCLING_COMPANY.value
        and batch.recycling_company_id
        != current_user_id
    ):

        return jsonify(
            error=(
                "You do not have permission "
                "to modify this recycling batch."
            )
        ), 403

    # --------------------------------------------------------
    # Request body
    # --------------------------------------------------------

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    new_status = data.get(
        "status"
    )

    weight_processed = data.get(
        "weight_processed"
    )

    notes = data.get(
        "notes"
    )

    allowed_statuses = {
        "received",
        "processing",
        "processed",
        "rejected",
        "sold",
    }

    # --------------------------------------------------------
    # Validate status
    # --------------------------------------------------------

    if (
        new_status
        and new_status
        not in allowed_statuses
    ):

        return jsonify(
            error=(
                "Invalid status. Allowed values: "
                f"{sorted(allowed_statuses)}"
            )
        ), 400

    # --------------------------------------------------------
    # Validate processed weight
    # --------------------------------------------------------

    if weight_processed is not None:

        try:

            weight_processed = float(
                weight_processed
            )

        except (
            TypeError,
            ValueError,
        ):

            return jsonify(
                error=(
                    "weight_processed must "
                    "be a valid number."
                )
            ), 400

        if weight_processed < 0:

            return jsonify(
                error=(
                    "weight_processed cannot "
                    "be negative."
                )
            ), 400

        if weight_processed > float(
            batch.weight_received or 0
        ):

            return jsonify(
                error=(
                    "Processed weight cannot "
                    "be greater than received weight."
                )
            ), 400

        batch.weight_processed = (
            weight_processed
        )

    # --------------------------------------------------------
    # Update status
    # --------------------------------------------------------

    if new_status:

        batch.status = new_status

        if new_status == "processed":

            if batch.weight_processed is None:

                return jsonify(
                    error=(
                        "weight_processed is required "
                        "when marking a batch as processed."
                    )
                ), 400

            batch.processed_at = (
                datetime.now(
                    timezone.utc
                )
            )

        elif new_status != "processed":

            batch.processed_at = None

    # --------------------------------------------------------
    # Update notes
    # --------------------------------------------------------

    if notes is not None:

        batch.notes = (
            str(notes)
            .strip()
            or None
        )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    try:

        db.session.commit()

    except Exception as exc:

        db.session.rollback()

        return jsonify(
            error=(
                "Failed to update recycling "
                f"batch: {exc}"
            )
        ), 500

    return jsonify(
        {
            "message": (
                "Recycling batch updated successfully."
            ),

            "batch": batch_to_dict(
                batch
            ),
        }
    ), 200