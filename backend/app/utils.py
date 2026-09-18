from functools import wraps
from uuid import uuid4

from flask import jsonify
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    verify_jwt_in_request,
)


def get_current_user_id():
    verify_jwt_in_request()
    return int(get_jwt_identity())


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()

            claims = get_jwt()

            if claims.get("role") not in roles:
                return jsonify(
                    error="You do not have permission to perform this action"
                ), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def make_reference(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10].upper()}"


def pagination_meta(pagination):
    return {
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    }