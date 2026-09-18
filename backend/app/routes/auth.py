import re

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy import or_

from ..extensions import db
from ..models import (
    ApprovalStatus,
    CollectorProfile,
    GovernmentProfile,
    RecyclingCompanyProfile,
    Role,
    User,
)
from ..security import limiter

auth_bp = Blueprint("auth", __name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_REGISTRATION_ROLES = {
    Role.CUSTOMER.value,
    Role.COLLECTOR.value,
    Role.RECYCLING_COMPANY.value,
    Role.GOVERNMENT.value,
}


def valid_password(password):
    return (
        len(password) >= 8
        and any(c.isalpha() for c in password)
        and any(c.isdigit() for c in password)
    )


def clean(value):
    return str(value or "").strip()


@auth_bp.post("/auth/register")
@limiter.limit("10 per hour")
def register():
    data = request.get_json(silent=True) or {}

    required = ["full_name", "email", "password"]
    missing = [field for field in required if not clean(data.get(field))]
    if missing:
        return jsonify(error="Missing required fields", fields=missing), 400

    full_name = clean(data.get("full_name"))
    email = clean(data.get("email")).lower()
    phone = clean(data.get("phone")) or None
    password = str(data.get("password") or "")
    role = clean(data.get("role") or Role.CUSTOMER.value).lower()

    if role not in ALLOWED_REGISTRATION_ROLES:
        return jsonify(error="Invalid registration role"), 400
    if not 2 <= len(full_name) <= 120:
        return jsonify(error="Full name must be between 2 and 120 characters"), 400
    if not EMAIL_PATTERN.match(email):
        return jsonify(error="Enter a valid email address"), 400
    if not valid_password(password):
        return jsonify(error="Password must be at least 8 characters and include letters and numbers"), 400
    if phone and len(phone) > 30:
        return jsonify(error="Phone number cannot exceed 30 characters"), 400

    duplicate_filter = User.email == email
    if phone:
        duplicate_filter = or_(User.email == email, User.phone == phone)
    if User.query.filter(duplicate_filter).first():
        return jsonify(error="An account with this email or phone already exists"), 409

    # Role-specific validation before opening the transaction.
    operating_area = clean(data.get("operating_area"))
    company_name = clean(data.get("company_name"))
    registration_number = clean(data.get("registration_number"))
    business_address = clean(data.get("business_address"))
    accepted_waste_types = clean(data.get("accepted_waste_types"))
    agency_name = clean(data.get("agency_name"))
    department = clean(data.get("department"))
    official_id = clean(data.get("official_id"))

    if role == Role.COLLECTOR.value and not operating_area:
        return jsonify(error="Operating area is required for collectors"), 400
    if role == Role.RECYCLING_COMPANY.value:
        missing_company = [
            name for name, value in {
                "company_name": company_name,
                "registration_number": registration_number,
                "business_address": business_address,
            }.items() if not value
        ]
        if missing_company:
            return jsonify(error="Missing recycling company fields", fields=missing_company), 400
        if RecyclingCompanyProfile.query.filter_by(registration_number=registration_number).first():
            return jsonify(error="That company registration number is already registered"), 409
    if role == Role.GOVERNMENT.value:
        missing_gov = [
            name for name, value in {
                "agency_name": agency_name,
                "official_id": official_id,
            }.items() if not value
        ]
        if missing_gov:
            return jsonify(error="Missing government verification fields", fields=missing_gov), 400
        if GovernmentProfile.query.filter_by(official_id=official_id).first():
            return jsonify(error="That official identification number is already registered"), 409

    # Customers are active immediately; privileged/operational roles require admin approval.
    requires_approval = role != Role.CUSTOMER.value
    approval_status = (
        ApprovalStatus.PENDING.value if requires_approval else ApprovalStatus.APPROVED.value
    )

    user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        role=role,
        approval_status=approval_status,
        is_active=not requires_approval,
    )
    user.set_password(password)

    try:
        db.session.add(user)
        db.session.flush()

        if role == Role.COLLECTOR.value:
            db.session.add(CollectorProfile(
                user_id=user.id,
                operating_area=operating_area,
                availability_status="unavailable",
            ))
        elif role == Role.RECYCLING_COMPANY.value:
            db.session.add(RecyclingCompanyProfile(
                user_id=user.id,
                company_name=company_name,
                registration_number=registration_number,
                business_address=business_address,
                accepted_waste_types=accepted_waste_types or None,
            ))
        elif role == Role.GOVERNMENT.value:
            db.session.add(GovernmentProfile(
                user_id=user.id,
                agency_name=agency_name,
                department=department or None,
                official_id=official_id,
            ))

        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("User registration failed")
        return jsonify(error="Unable to complete registration"), 500

    if requires_approval:
        message = "Registration submitted successfully. Your account is awaiting administrative approval."
    else:
        message = "Registration successful"

    return jsonify(
        message=message,
        requires_approval=requires_approval,
        user=user.to_dict(),
    ), 201


@auth_bp.post("/auth/login")
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = clean(data.get("email")).lower()
    password = str(data.get("password") or "")

    if not email or not password:
        return jsonify(error="Email and password are required"), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(error="Invalid email or password"), 401

    if not user.is_active:
        if user.approval_status == ApprovalStatus.PENDING.value:
            return jsonify(error="Your account is awaiting administrative approval"), 403
        return jsonify(error="This account has been disabled"), 403

    claims = {"role": user.role, "name": user.full_name}
    return jsonify(
        access_token=create_access_token(identity=str(user.id), additional_claims=claims),
        refresh_token=create_refresh_token(identity=str(user.id), additional_claims=claims),
        user=user.to_dict(),
    )


@auth_bp.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return jsonify(error="Invalid authentication identity"), 401

    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return jsonify(error="User account is unavailable"), 401

    claims = {"role": user.role, "name": user.full_name}
    return jsonify(access_token=create_access_token(identity=str(user.id), additional_claims=claims))
