from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import CheckConstraint
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class Role(str, Enum):
    CUSTOMER = "customer"
    COLLECTOR = "collector"
    RECYCLING_COMPANY = "recycling_company"
    ADMIN = "admin"
    GOVERNMENT = "government"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PickupStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    EN_ROUTE = "en_route"
    COLLECTED = "collected"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"
    
    



class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class SystemSetting(TimestampMixin, db.Model):
    """Persist administrator-configurable application settings."""

    __tablename__ = "system_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.JSON, nullable=False, default=dict)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.String(30), default=Role.CUSTOMER.value, nullable=False, index=True
    )
    approval_status = db.Column(
        db.String(30),
        default=ApprovalStatus.APPROVED.value,
        nullable=False,
        index=True,
    )
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    addresses = db.relationship(
        "Address",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    customer_pickups = db.relationship(
        "PickupRequest",
        foreign_keys="PickupRequest.customer_id",
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    assigned_pickups = db.relationship(
        "PickupRequest",
        foreign_keys="PickupRequest.collector_id",
        back_populates="collector",
        lazy="dynamic",
    )

    invoices = db.relationship(
        "Invoice",
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    complaints = db.relationship(
        "Complaint",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    notifications = db.relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    reward_transactions = db.relationship(
        "RewardTransaction",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "approval_status": self.approval_status,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Address(TimestampMixin, db.Model):
    __tablename__ = "addresses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    label = db.Column(db.String(50), default="Home")
    street = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    is_default = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="addresses")
    pickups = db.relationship(
        "PickupRequest", back_populates="address", lazy="dynamic"
    )

    @property
    def full_address(self):
        return ", ".join(
            filter(
                None,
                [
                    self.street,
                    self.city,
                    self.state,
                ],
            )
        )

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "street": self.street,
            "city": self.city,
            "state": self.state,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "is_default": self.is_default,
        }


class WasteCategory(TimestampMixin, db.Model):
    __tablename__ = "waste_categories"
    __table_args__ = (
        CheckConstraint(
            "price_per_kg >= 0", name="ck_waste_category_price_nonnegative"
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    recyclable = db.Column(db.Boolean, default=False, nullable=False)
    price_per_kg = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)

    pickups = db.relationship(
        "PickupRequest", back_populates="waste_category", lazy="dynamic"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "recyclable": self.recyclable,
            "price_per_kg": float(self.price_per_kg or 0),
            "active": self.active,
        }


class Vehicle(TimestampMixin, db.Model):
    __tablename__ = "vehicles"
    __table_args__ = (
        CheckConstraint("capacity_kg > 0", name="ck_vehicle_capacity_positive"),
    )

    id = db.Column(db.Integer, primary_key=True)
    registration_number = db.Column(db.String(50), unique=True, nullable=False)
    vehicle_type = db.Column(db.String(100), nullable=False)
    capacity_kg = db.Column(db.Numeric(12, 2), nullable=False)
    status = db.Column(db.String(30), default="available", nullable=False)
    last_service_date = db.Column(db.Date, nullable=True)

    collector_profiles = db.relationship(
        "CollectorProfile", back_populates="vehicle", lazy="dynamic"
    )
    pickups = db.relationship(
        "PickupRequest", back_populates="vehicle", lazy="dynamic"
    )

    def to_dict(self):
        # Look up assigned collector profile if present
        assigned_collector = None
        collector_profile = self.collector_profiles.first() if self.collector_profiles else None
        if collector_profile and collector_profile.user:
            assigned_collector = collector_profile.user.full_name

        return {
            "id": self.id,
            "registration_number": self.registration_number,
            "vehicle_type": self.vehicle_type,
            "capacity_kg": float(self.capacity_kg or 0),
            "status": self.status,
            "last_service_date": (
                self.last_service_date.isoformat()
                if self.last_service_date
                else None
            ),
            "assigned_collector": assigned_collector,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CollectorProfile(TimestampMixin, db.Model):
    __tablename__ = "collector_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"))
    collector_code = db.Column(
        db.String(25), unique=True, nullable=True, index=True
    )
    operating_area = db.Column(db.String(150), nullable=False)
    availability_status = db.Column(
        db.String(30), default="unavailable", nullable=False
    )
    rating = db.Column(db.Numeric(3, 2), default=5)

    user = db.relationship("User", foreign_keys=[user_id])
    vehicle = db.relationship("Vehicle", back_populates="collector_profiles")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.to_dict() if self.user else None,
            "vehicle": self.vehicle.to_dict() if self.vehicle else None,
            "collector_code": self.collector_code,
            "operating_area": self.operating_area,
            "availability_status": self.availability_status,
            "rating": float(self.rating or 0),
        }


class RecyclingCompanyProfile(TimestampMixin, db.Model):
    __tablename__ = "recycling_company_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    company_name = db.Column(db.String(180), nullable=False)
    registration_number = db.Column(db.String(100), unique=True, nullable=False)
    business_address = db.Column(db.String(255), nullable=False)
    accepted_waste_types = db.Column(db.Text)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.to_dict() if self.user else None,
            "company_name": self.company_name,
            "registration_number": self.registration_number,
            "business_address": self.business_address,
            "accepted_waste_types": self.accepted_waste_types,
        }


class GovernmentProfile(TimestampMixin, db.Model):
    __tablename__ = "government_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    agency_name = db.Column(db.String(180), nullable=False)
    department = db.Column(db.String(150))
    official_id = db.Column(db.String(100), unique=True, nullable=False)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.to_dict() if self.user else None,
            "agency_name": self.agency_name,
            "department": self.department,
            "official_id": self.official_id,
        }


class PickupRequest(TimestampMixin, db.Model):
    __tablename__ = "pickup_requests"
    __table_args__ = (
        CheckConstraint(
            "estimated_weight > 0", name="ck_pickup_estimated_weight_positive"
        ),
        CheckConstraint(
            "actual_weight IS NULL OR actual_weight > 0",
            name="ck_pickup_actual_weight_positive",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(30), unique=True, nullable=False, index=True)
    customer_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    address_id = db.Column(
        db.Integer, db.ForeignKey("addresses.id"), nullable=False
    )
    waste_category_id = db.Column(
        db.Integer, db.ForeignKey("waste_categories.id"), nullable=False
    )
    collector_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True
    )
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), index=True)
    pickup_date = db.Column(db.Date, nullable=False, index=True)
    preferred_time = db.Column(db.String(30), nullable=False)
    estimated_weight = db.Column(db.Numeric(12, 2), nullable=False)
    actual_weight = db.Column(db.Numeric(12, 2))
    status = db.Column(
        db.String(30), default=PickupStatus.PENDING.value, nullable=False, index=True
    )
    notes = db.Column(db.Text)
    collector_note = db.Column(db.Text)
    evidence_url = db.Column(db.String(500))
    completed_at = db.Column(db.DateTime(timezone=True))

    customer = db.relationship(
        "User", foreign_keys=[customer_id], back_populates="customer_pickups"
    )
    collector = db.relationship(
        "User", foreign_keys=[collector_id], back_populates="assigned_pickups"
    )
    vehicle = db.relationship("Vehicle", back_populates="pickups")
    address = db.relationship("Address", back_populates="pickups")
    waste_category = db.relationship("WasteCategory", back_populates="pickups")
    invoice = db.relationship(
        "Invoice", back_populates="pickup", uselist=False, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "customer": self.customer.to_dict() if self.customer else None,
            "address": self.address.to_dict() if self.address else None,
            "waste_category": self.waste_category.to_dict()
            if self.waste_category
            else None,
            "collector": self.collector.to_dict() if self.collector else None,
            "vehicle": self.vehicle.to_dict() if self.vehicle else None,
            "pickup_date": self.pickup_date.isoformat() if self.pickup_date else None,
            "preferred_time": self.preferred_time,
            "estimated_weight": float(self.estimated_weight or 0),
            "actual_weight": float(self.actual_weight)
            if self.actual_weight is not None
            else None,
            "status": self.status,
            "notes": self.notes,
            "collector_note": self.collector_note,
            "evidence_url": self.evidence_url,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
            "invoice": self.invoice.to_dict() if self.invoice else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        
class RecyclingBatch(TimestampMixin, db.Model):
    __tablename__ = "recycling_batches"

    id = db.Column(db.Integer, primary_key=True)

    pickup_id = db.Column(
        db.Integer,
        db.ForeignKey("pickup_requests.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    recycling_company_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    waste_category_id = db.Column(
        db.Integer,
        db.ForeignKey("waste_categories.id"),
        nullable=False,
        index=True,
    )

    weight_received = db.Column(
        db.Numeric(12, 2),
        nullable=False,
    )

    weight_processed = db.Column(
        db.Numeric(12, 2),
        nullable=True,
    )

    status = db.Column(
        db.String(30),
        default="received",
        nullable=False,
        index=True,
    )

    received_at = db.Column(
        db.DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    processed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    notes = db.Column(db.Text)

    pickup = db.relationship(
        "PickupRequest",
        backref=db.backref("recycling_batch", uselist=False),
    )

    recycling_company = db.relationship(
        "User",
        foreign_keys=[recycling_company_id],
    )

    waste_category = db.relationship(
        "WasteCategory",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "pickup_id": self.pickup_id,
            "pickup_reference": (
                self.pickup.reference
                if self.pickup
                else None
            ),
            "recycling_company_id": self.recycling_company_id,
            "recycling_company": (
                self.recycling_company.full_name
                if self.recycling_company
                else None
            ),
            "waste_category": (
                self.waste_category.to_dict()
                if self.waste_category
                else None
            ),
            "weight_received": float(
                self.weight_received or 0
            ),
            "weight_processed": (
                float(self.weight_processed)
                if self.weight_processed is not None
                else None
            ),
            "status": self.status,
            "received_at": (
                self.received_at.isoformat()
                if self.received_at
                else None
            ),
            "processed_at": (
                self.processed_at.isoformat()
                if self.processed_at
                else None
            ),
            "notes": self.notes,
            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
        }


class Invoice(TimestampMixin, db.Model):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("total >= 0", name="ck_invoice_total_nonnegative"),
    )

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(
        db.String(40), unique=True, nullable=False, index=True
    )
    pickup_id = db.Column(
        db.Integer, db.ForeignKey("pickup_requests.id"), unique=True, nullable=False
    )
    customer_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    subtotal = db.Column(db.Numeric(12, 2), nullable=False)
    tax = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    discount = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), nullable=False)
    status = db.Column(
        db.String(30), default=PaymentStatus.PENDING.value, nullable=False, index=True
    )
    due_date = db.Column(db.Date, nullable=False)

    pickup = db.relationship("PickupRequest", back_populates="invoice")
    customer = db.relationship("User", back_populates="invoices")
    payments = db.relationship(
        "Payment",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="Payment.created_at.desc()",
    )

    def to_dict(self):
        latest_payment = self.payments[0] if self.payments else None

        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "pickup_id": self.pickup_id,
            "pickup_reference": self.pickup.reference if self.pickup else None,
            "customer_id": self.customer_id,
            "subtotal": float(self.subtotal or 0),
            "tax": float(self.tax or 0),
            "discount": float(self.discount or 0),
            "total": float(self.total or 0),
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "latest_payment": latest_payment.to_dict() if latest_payment else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Payment(TimestampMixin, db.Model):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_payment_amount_nonnegative"),
    )

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(
        db.Integer, db.ForeignKey("invoices.id"), nullable=False, index=True
    )
    transaction_reference = db.Column(
        db.String(80), unique=True, nullable=False, index=True
    )
    gateway_reference = db.Column(db.String(100))
    provider = db.Column(db.String(30), default="demo", nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    currency = db.Column(db.String(10), default="NGN", nullable=False)
    payment_method = db.Column(db.String(30))
    status = db.Column(
        db.String(30), default=PaymentStatus.PENDING.value, nullable=False, index=True
    )
    authorization_url = db.Column(db.String(500))
    paid_at = db.Column(db.DateTime(timezone=True))

    invoice = db.relationship("Invoice", back_populates="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "transaction_reference": self.transaction_reference,
            "gateway_reference": self.gateway_reference,
            "provider": self.provider,
            "amount": float(self.amount or 0),
            "currency": self.currency,
            "payment_method": self.payment_method,
            "status": self.status,
            "authorization_url": self.authorization_url,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Complaint(TimestampMixin, db.Model):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    pickup_id = db.Column(db.Integer, db.ForeignKey("pickup_requests.id"))
    subject = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), default="open", nullable=False, index=True)
    admin_response = db.Column(db.Text)

    user = db.relationship("User", back_populates="complaints")
    pickup = db.relationship("PickupRequest")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.to_dict() if self.user else None,
            "pickup_id": self.pickup_id,
            "subject": self.subject,
            "description": self.description,
            "status": self.status,
            "admin_response": self.admin_response,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Notification(TimestampMixin, db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    title = db.Column(db.String(180), nullable=False)
    message = db.Column(db.Text, nullable=False)
    read_status = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship("User", back_populates="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "read_status": self.read_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class RewardTransaction(TimestampMixin, db.Model):
    __tablename__ = "reward_transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    pickup_id = db.Column(
        db.Integer, db.ForeignKey("pickup_requests.id"), unique=True
    )
    points = db.Column(db.Integer, nullable=False)
    transaction_type = db.Column(db.String(30), nullable=False)
    description = db.Column(db.String(255), nullable=False)

    user = db.relationship("User", back_populates="reward_transactions")
    pickup = db.relationship("PickupRequest")

    def to_dict(self):
        return {
            "id": self.id,
            "pickup_id": self.pickup_id,
            "points": self.points,
            "transaction_type": self.transaction_type,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }