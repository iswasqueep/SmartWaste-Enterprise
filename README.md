# SmartWaste Enterprise

A capstone-ready, full-stack digital waste management system built with React, Flask and PostgreSQL. It includes responsive operations dashboards, role-based authentication, pickup management, invoicing, demo e-payment, complaints, notifications, recycling rewards and reporting.

## Local quick start

### Backend
```bat
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed.py
python run.py
```

### Frontend
```bat
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. Demo admin: `admin@smartwaste.local` / `Admin123!`.

## Docker
```bash
docker compose up --build
```

## Delivery phases represented
1. Responsive React UX and role-ready navigation.
2. Flask REST API with JWT and RBAC.
3. SQLAlchemy schema, migrations and PostgreSQL configuration.
4. Invoice/e-payment workflow with safe demo gateway and Paystack integration boundary.
5. Notifications, complaints, rewards, fleet and reporting modules.
6. AI/IoT extension points documented for later model and sensor integration.
7. Docker, tests, CI workflow and architecture/system-requirement documentation.

See `docs/` and `backend/README.md` for endpoint details.
