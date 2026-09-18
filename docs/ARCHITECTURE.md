# Architecture

React/Vite SPA communicates with a modular Flask REST API. Flask uses SQLAlchemy and PostgreSQL, with SQLite available for local demonstrations. Payment operations are abstracted so demo mode can be replaced with Paystack. Deployment supports separate frontend/backend hosting or Docker Compose.

```text
Browser -> React SPA -> Flask API -> PostgreSQL
                       |-> Payment gateway
                       |-> Email/SMS service
                       |-> Object storage
                       |-> Maps/routing provider
```

Production extensions: Redis/Celery for background jobs, S3-compatible storage for evidence, OpenTelemetry/Sentry for monitoring, Nginx/API gateway for TLS and rate limiting.
