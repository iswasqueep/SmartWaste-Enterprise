from .admin import admin_bp
from .auth import auth_bp
from .collector import collector_bp
from .complaints import complaints_bp
from .customer import customer_bp
from .government import government_bp
from .notifications import notifications_bp
from .payments import payments_bp
from .pickups import pickups_bp
from .profile import profile_bp
from .public import public_bp
from .reports import reports_bp
from .recycling import recycling_bp


def register_blueprints(app):
    blueprints = (
        public_bp,
        auth_bp,
        profile_bp,
        pickups_bp,
        payments_bp,
        complaints_bp,
        notifications_bp,
        reports_bp,
        admin_bp,
        customer_bp,
        collector_bp,
        recycling_bp,
        government_bp,
    )

    names = [blueprint.name for blueprint in blueprints]

    if len(names) != len(set(names)):
        duplicates = sorted(
            name for name in set(names)
            if names.count(name) > 1
        )
        raise RuntimeError(
            "Duplicate Flask blueprint registration: "
            + ", ".join(duplicates)
        )

    for blueprint in blueprints:
        app.register_blueprint(
            blueprint,
            url_prefix="/api",
        )
