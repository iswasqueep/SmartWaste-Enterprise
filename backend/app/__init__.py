from flask import Flask, jsonify
from sqlalchemy import text

from config import Config
from .extensions import cors, db, jwt, migrate
from .security import init_security


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    if hasattr(config_object, "validate_production"):
        config_object.validate_production()

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    allowed_origins = [
        origin.strip()
        for origin in str(
            app.config.get(
                "FRONTEND_URL",
                "http://localhost:5173",
            )
        ).split(",")
        if origin.strip()
    ]

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    init_security(app)

    from . import models  # noqa: F401
    from .routes import register_blueprints

    register_blueprints(app)

    @jwt.unauthorized_loader
    def missing_token(_reason):
        return jsonify(error="Authentication required"), 401

    @jwt.invalid_token_loader
    def invalid_token(_reason):
        return jsonify(error="Invalid authentication token"), 401

    @jwt.expired_token_loader
    def expired_token(_header, _payload):
        return jsonify(error="Authentication token has expired"), 401

    @app.get("/api/health")
    def health():
        return jsonify(
            status="healthy",
            service="smartwaste-api",
        ), 200

    @app.get("/api/ready")
    def readiness():
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify(
                status="ready",
                service="smartwaste-api",
                database="ok",
            ), 200
        except Exception:
            db.session.rollback()
            app.logger.exception("Readiness database check failed")
            return jsonify(
                status="not_ready",
                service="smartwaste-api",
                database="unavailable",
            ), 503

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error="Resource not found"), 404

    @app.errorhandler(413)
    def payload_too_large(_error):
        return jsonify(error="Uploaded file is too large"), 413

    @app.errorhandler(500)
    def internal_error(_error):
        db.session.rollback()
        app.logger.exception("Unhandled application error")
        return jsonify(
            error="An internal server error occurred"
        ), 500

    return app
