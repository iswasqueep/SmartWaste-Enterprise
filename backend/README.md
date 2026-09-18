# SmartWaste Flask Backend

A modular Flask REST API for the SmartWaste digital waste-management platform.

## Included modules

- JWT registration, login and refresh
- Customer, collector, administrator and government roles
- Customer addresses and profiles
- Waste categories
- Pickup creation, assignment and status workflow
- Automatic invoice generation
- Demo e-payment workflow and payment history
- Recycling rewards
- Complaints and administrative resolution
- Notifications
- Vehicles and collector profiles
- Administrative dashboard analytics
- SQLite development database and PostgreSQL support
- Flask-Migrate and pytest configuration

## Windows setup

```bat
cd /d "C:\path\to\smartwaste-backend"
py -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
python seed.py
python run.py
```

API address:

```text
http://localhost:5000/api
```

Health check:

```text
http://localhost:5000/api/health
```

## Demo users

| Role | Email | Password |
|---|---|---|
| Admin | admin@smartwaste.local | Admin123! |
| Customer | customer@smartwaste.local | Customer123! |
| Collector | collector@smartwaste.local | Collector123! |
| Government | government@smartwaste.local | Government123! |

Change these passwords before any real deployment.

## PostgreSQL

Create a PostgreSQL database and set `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/smartwaste_db
```

Then use migrations:

```bat
set FLASK_APP=run.py
flask db init
flask db migrate -m "Initial database"
flask db upgrade
python seed.py
```

Run `flask db init` only once for a new project.

## Main API routes

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Customer profile

- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/addresses`
- `GET /api/rewards`

### Pickups

- `POST /api/pickups`
- `GET /api/pickups`
- `GET /api/pickups/<id>`
- `PATCH /api/pickups/<id>/status`

### Billing and payments

- `GET /api/invoices`
- `POST /api/payments/initialize`
- `POST /api/payments/demo-complete`
- `GET /api/payments/history`

### Complaints and notifications

- `POST /api/complaints`
- `GET /api/complaints`
- `PATCH /api/complaints/<id>`
- `GET /api/notifications`
- `PATCH /api/notifications/<id>/read`

### Administration and reports

- `GET /api/admin/users`
- `PATCH /api/admin/users/<id>/status`
- `POST /api/admin/waste-categories`
- `GET /api/admin/collectors`
- `POST /api/admin/vehicles`
- `POST /api/admin/pickups/<id>/assign`
- `GET /api/reports/dashboard`

## Authorization header

After login, send the JWT access token:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## React connection

Create an Axios client in the frontend:

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Tests

```bat
pytest
```

## Payment note

The default `PAYMENT_PROVIDER=demo` allows the capstone to demonstrate invoice creation and successful or failed payments without processing real money. A production gateway should be implemented server-side in `app/routes/payments.py`, with server-side verification and webhook signature validation.
