“Audit my backend architecture with the same level of scrutiny used by top tech
companies (Meta, Netflix, Amazon). I need a deep technical evaluation across the
following categories:

Security

Authentication, authorization, role-based access

Token strategy (access/refresh), expiration flow, rotation

HTTPS, HTTP-only cookies, secure cookie flags

Input validation, sanitization, CSRF, XSS, NoSQL/SQL injection

Password hashing, encryption, rate limiting, anti-bruteforce

Logging of auth events, suspicious behaviors

Secrets management

Scalability & Architecture

Modular structure

Separation of concerns (controllers/services/repositories)

SOLID principles

Async performance bottlenecks

Caching (Redis), queues (BullMQ)

Load balancing and horizontal scaling

Database indexing, schema structure

Event-driven patterns if needed

API Design Quality

REST standards

Versioning

DTO validation

Error handling format

Pagination, filtering, sorting

Consistency, naming standards

Rate limits per route

Testing & Reliability

Unit tests

Integration tests

E2E tests

Mocking strategies

Test coverage requirements

CI/CD integration

DevOps & Deployment

Containerization (Docker) best practices

Monitoring (Prometheus, Grafana)

Logging (structured logs, correlation IDs)

Zero-downtime deploys

Rollbacks strategy

Environment configs

Code Quality

Linting rules

File structure

Naming conventions

Comments & documentation

Dead code detection

Performance smell detection if there is something missing some functions or
files I want you to evaluate my backend like a senior principal engineer doing a
production readiness review. For every issue you detect, provide:

Severity (Critical / High / Medium / Low)

Why it’s a problem

Exact fix

Example of the correct implementation

How big tech companies handle similar cases

A final score for the backend’s production readiness
