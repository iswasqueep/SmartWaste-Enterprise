# SmartWaste System Requirements

## Roles
Customer, Collector, Administrator, Recycling Partner and Government/Environmental Officer.

## Core functions
Secure registration/login; address management; pickup booking and tracking; automatic invoicing; electronic payment; collector assignment; vehicle/fleet management; evidence upload; complaints; notifications; recycling rewards; dashboards; audit-ready reports.

## Non-functional requirements
Responsive UI; JWT/RBAC; validation; encrypted transport in production; database backups; paginated APIs; audit logs; observability; 99.5% target availability; modular deployment; accessible forms; recovery procedures.

## Security baseline
Password hashing, least privilege, secret management, rate limiting at reverse proxy, CORS allow-list, secure webhook verification, file type/size restrictions, logging without sensitive values, dependency scanning, protected CI/CD variables.
