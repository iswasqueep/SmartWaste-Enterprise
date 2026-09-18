from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import get_jwt_identity

from ..extensions import db
from ..models import Notification
from ..utils import role_required
from ..models import Role


notifications_bp = Blueprint(
    "notifications",
    __name__,
)


def current_user_id():
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


@notifications_bp.get("/notifications")
@role_required(Role.CUSTOMER.value)
def list_notifications():
    user_id = current_user_id()

    if not user_id:
        return jsonify(
            error="Invalid authentication identity"
        ), 401

    notifications = (
        Notification.query
        .filter_by(user_id=user_id)
        .order_by(
            Notification.created_at.desc()
        )
        .limit(100)
        .all()
    )

    unread_count = (
        Notification.query
        .filter_by(
            user_id=user_id,
            read_status=False,
        )
        .count()
    )

    return jsonify(
        notifications=[
            item.to_dict()
            for item in notifications
        ],
        unread_count=unread_count,
    )


@notifications_bp.patch(
    "/notifications/<int:notification_id>/read"
)
@role_required(Role.CUSTOMER.value)
def mark_notification_read(notification_id):
    user_id = current_user_id()

    notification = (
        Notification.query
        .filter_by(
            id=notification_id,
            user_id=user_id,
        )
        .first()
    )

    if not notification:
        return jsonify(
            error="Notification not found"
        ), 404

    notification.read_status = True

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Unable to mark notification as read"
        )

        return jsonify(
            error="Unable to update notification"
        ), 500

    return jsonify(
        message="Notification marked as read",
        notification=notification.to_dict(),
    )


@notifications_bp.patch(
    "/notifications/read-all"
)
@role_required(Role.CUSTOMER.value)
def mark_all_notifications_read():
    user_id = current_user_id()

    if not user_id:
        return jsonify(
            error="Invalid authentication identity"
        ), 401

    try:
        (
            Notification.query
            .filter_by(
                user_id=user_id,
                read_status=False,
            )
            .update(
                {"read_status": True},
                synchronize_session=False,
            )
        )

        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Unable to mark all notifications as read"
        )

        return jsonify(
            error="Unable to update notifications"
        ), 500

    return jsonify(
        message="All notifications marked as read"
    )


@notifications_bp.delete(
    "/notifications/<int:notification_id>"
)
@role_required(Role.CUSTOMER.value)
def delete_notification(notification_id):
    user_id = current_user_id()

    notification = (
        Notification.query
        .filter_by(
            id=notification_id,
            user_id=user_id,
        )
        .first()
    )

    if not notification:
        return jsonify(
            error="Notification not found"
        ), 404

    try:
        db.session.delete(notification)
        db.session.commit()
    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Unable to delete notification"
        )

        return jsonify(
            error="Unable to delete notification"
        ), 500

    return jsonify(
        message="Notification deleted successfully"
    )