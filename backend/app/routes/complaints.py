from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Complaint, PickupRequest, Role
from ..utils import role_required

complaints_bp = Blueprint("complaints", __name__)


@complaints_bp.post("/complaints")
@jwt_required()
def create_complaint():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    if not data.get("subject") or not data.get("description"):
        return jsonify(error="Subject and description are required"), 400
    pickup_id = data.get("pickup_id")
    if pickup_id:
        pickup = PickupRequest.query.filter_by(id=pickup_id, customer_id=user_id).first()
        if not pickup:
            return jsonify(error="Pickup request not found"), 404
    complaint = Complaint(user_id=user_id, pickup_id=pickup_id, subject=data["subject"], description=data["description"])
    db.session.add(complaint)
    db.session.commit()
    return jsonify(message="Complaint submitted", complaint=complaint.to_dict()), 201


@complaints_bp.get("/complaints")
@jwt_required()
def list_complaints():
    user_id = int(get_jwt_identity())
    query = Complaint.query
    if get_jwt().get("role") == Role.CUSTOMER.value:
        query = query.filter_by(user_id=user_id)
    rows = query.order_by(Complaint.created_at.desc()).all()
    return jsonify(items=[row.to_dict() for row in rows])


@complaints_bp.patch("/complaints/<int:complaint_id>")
@role_required(Role.ADMIN.value)
def resolve_complaint(complaint_id):
    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify(error="Complaint not found"), 404
    data = request.get_json(silent=True) or {}
    complaint.status = data.get("status", complaint.status)
    complaint.admin_response = data.get("admin_response", complaint.admin_response)
    db.session.commit()
    return jsonify(message="Complaint updated", complaint=complaint.to_dict())
