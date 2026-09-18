from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Address, RewardTransaction, User

profile_bp = Blueprint("profile", __name__)


@profile_bp.get("/profile")
@jwt_required()
def get_profile():
    user = db.session.get(User, int(get_jwt_identity()))
    points = db.session.query(db.func.coalesce(db.func.sum(RewardTransaction.points), 0)).filter_by(user_id=user.id).scalar()
    return jsonify(user=user.to_dict(), addresses=[a.to_dict() for a in user.addresses], reward_points=int(points or 0))


@profile_bp.put("/profile")
@jwt_required()
def update_profile():
    user = db.session.get(User, int(get_jwt_identity()))
    data = request.get_json(silent=True) or {}
    if data.get("full_name"):
        user.full_name = data["full_name"].strip()
    if "phone" in data:
        user.phone = (data.get("phone") or "").strip() or None
    db.session.commit()
    return jsonify(message="Profile updated", user=user.to_dict())


@profile_bp.post("/addresses")
@jwt_required()
def create_address():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    for field in ("street", "city", "state"):
        if not str(data.get(field, "")).strip():
            return jsonify(error=f"{field} is required"), 400

    if data.get("is_default"):
        Address.query.filter_by(user_id=user_id).update({"is_default": False})

    address = Address(
        user_id=user_id,
        label=data.get("label", "Home"),
        street=data["street"].strip(),
        city=data["city"].strip(),
        state=data["state"].strip(),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        is_default=bool(data.get("is_default")),
    )
    db.session.add(address)
    db.session.commit()
    return jsonify(message="Address added", address=address.to_dict()), 201


@profile_bp.get("/rewards")
@jwt_required()
def rewards():
    user_id = int(get_jwt_identity())
    rows = RewardTransaction.query.filter_by(user_id=user_id).order_by(RewardTransaction.created_at.desc()).all()
    balance = sum(row.points for row in rows)
    return jsonify(balance=balance, transactions=[row.to_dict() for row in rows])
