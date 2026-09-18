from flask import Blueprint, jsonify

from ..models import WasteCategory

public_bp = Blueprint("public", __name__)


@public_bp.get("/waste-categories")
def waste_categories():
    rows = WasteCategory.query.filter_by(active=True).order_by(WasteCategory.name).all()
    return jsonify(items=[row.to_dict() for row in rows])
