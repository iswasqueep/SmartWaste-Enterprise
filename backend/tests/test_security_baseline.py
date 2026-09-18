from app.extensions import db
from app.models import Role, User


def create_user(email="customer@example.com", role=Role.CUSTOMER.value):
    user = User(
        full_name="Test User",
        email=email,
        role=role,
        is_active=True,
    )
    user.set_password("StrongPass123")
    db.session.add(user)
    db.session.commit()
    return user


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "healthy"


def test_readiness_endpoint(client):
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ready"


def test_security_headers(client):
    response = client.get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert (
        response.headers["Referrer-Policy"]
        == "strict-origin-when-cross-origin"
    )


def test_invalid_login(client, app):
    with app.app_context():
        create_user()

    response = client.post(
        "/api/auth/login",
        json={
            "email": "customer@example.com",
            "password": "WrongPassword123",
        },
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_valid_login(client, app):
    with app.app_context():
        create_user()

    response = client.post(
        "/api/auth/login",
        json={
            "email": "customer@example.com",
            "password": "StrongPass123",
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["role"] == Role.CUSTOMER.value


def test_registration_does_not_return_password(client):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": "New User",
            "email": "new@example.com",
            "password": "StrongPass123",
        },
    )

    assert response.status_code == 201
    assert "password" not in response.get_json()["user"]


def test_duplicate_registration(client, app):
    with app.app_context():
        create_user()

    response = client.post(
        "/api/auth/register",
        json={
            "full_name": "Another User",
            "email": "customer@example.com",
            "password": "StrongPass123",
        },
    )

    assert response.status_code == 409
