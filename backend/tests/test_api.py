def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json["status"] == "healthy"


def test_register_and_login(client):
    payload = {
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "Password123!",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201
    response = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert response.status_code == 200
    assert response.json["access_token"]
