# CEO Command Center — Repository Audit & Delivery Plan

Audit date: 2026-11-13
Audited branch: main
Audited commit: c7df85e63507d5424e86c5da1298ea0bdc71830b

## Executive assessment

The repository is a small monorepo with an Express/Node backend, a Next.js frontend, a Drizzle/PostgreSQL schema, and three exported n8n workflows. It is a useful prototype foundation, but it is not yet a production-ready full CEO operating system. The current backend has five route groups: auth, dashboard, approvals, meetings, and notifications. CRM, HRMS, operations, knowledge/AI workforce, and a central integration/event layer are not implemented in this repository; the frontend currently links to separately deployed CRM, billing, and HRMS URLs and marks other modules as coming soon.

No GitHub Actions workflow runs were returned for this repository at audit time. The backend package's test script intentionally exits with "no test specified", so there is no automated backend test suite configured in package.json.

## Findings

### Critical security and identity
- Public registration is enabled without an invite, bootstrap, or allowlist gate.
- The general protect middleware accepts a single SERVICE_API_KEY and elevates it to a synthetic admin identity. This makes the service credential effectively equivalent to a human administrator on every route using protect.
- The user schema has no role, status, tenant, or audit metadata; the JWT only carries sub.
- Refresh rotation performs insert and revoke as separate database operations, without a transaction or row lock. Concurrent refresh requests can race.
- Refresh cookie uses SameSite=None outside development; this needs a deliberate production origin/CSRF design.
- The checked-in scheduling workflow JSON contains an embedded API-key value and a development ngrok endpoint. Treat the embedded credential as exposed: rotate it in the receiving service and replace it with n8n credentials/secret storage.

### Backend correctness and reliability
- The server starts listening without startup validation for required environment variables or a database readiness check.
- The global error handler assumes a ZodError shape that may differ by installed Zod version; validation errors should be normalized.
- The backend's test script is a placeholder.
- The dashboard stats controller signs a one-minute proxy JWT using BILLING_JWT_SECRET; this depends on exact secret/claim compatibility with the billing service and has no timeout or circuit-breaker behavior.
- Approval status is written to PostgreSQL before notifying n8n; webhook failure is only logged. There is no durable outbox/retry mechanism, and the decision event omits approval id and actor.
- Approval, briefing, meeting, and notification records are global rather than scoped to an authenticated user/organization.
- Meeting creation and notification creation are separate writes rather than one transaction.
- API validation is inconsistent: auth uses Zod, while several other controllers use ad-hoc checks.
- There is no pagination/retention policy for approval and notification history.

### Frontend integration
- Frontend API fallback points to localhost:8000 while backend defaults to 5001; HANDOFF.md says 5000. These defaults are inconsistent.
- Frontend stores the access token in localStorage while the refresh token is an HttpOnly cookie. This increases exposure to XSS and needs a deliberate auth design.
- The dashboard depends on billing stats; CRM/Billing/HRMS URLs are external environment configuration and are not provisioned by this repository.
- Several module cards are marked Live based on configuration/status literals rather than a backend health check.

### n8n workflow readiness
- Three workflows are exported but are inactive in the JSON and require credentials to be reconnected after import.
- Scheduling workflow contains a development tunnel URL and an embedded API key.
- Workflow exports are not proof of a live n8n deployment. Activation, credential mapping, webhook URLs, execution logs, and retry behavior must be verified in the target n8n instance.

## Delivery plan

### Stage 0 — Audit and baseline
- Preserve main; work on feat/ceo-command-center-backend-hardening.
- Record route, schema, environment, integration, workflow, and deployment requirements.
- Establish repeatable build/test checks before broad changes.

### Stage 1 — Security and backend foundations
- Validate required environment variables and startup readiness.
- Separate human authentication from service-to-service authentication; never map a shared service key to a human admin.
- Introduce explicit roles and controlled initial CEO bootstrap/invitation flow.
- Make refresh-token rotation atomic and add CSRF/origin protections consistent with deployment topology.
- Standardize validation, error handling, request IDs, logging, rate limits, and health/readiness endpoints.
- Remove secrets and development endpoints from workflow exports; rotate any exposed credential.

### Stage 2 — Core executive domain
- Add organization/user ownership, role-based access control, audit log, and durable event/outbox records.
- Complete approvals, briefings, meetings, notifications, and CEO tasks with pagination, filters, status transitions, and transaction safety.
- Add idempotent service endpoints for n8n callbacks.

### Stage 3 — Integration platform
- Build a central integration registry and adapters for Billing, CRM, and HRMS.
- Use scoped service credentials, timeouts, retries, health checks, and normalized error contracts.
- Keep modules independently deployable; CEO Command Center remains the control plane.

### Stage 4 — AI workforce and operations
- Add governed agent/task registry, tool permissions, approval gates, execution history, budgets/limits, and human escalation.
- Connect executive briefing, approval, scheduling, and notification workflows via authenticated webhooks/outbox events.
- Add knowledge ingestion/search only after access controls and data boundaries are established.

### Stage 5 — Verification and release
- Unit, integration, contract, migration, and authorization tests.
- Build/lint checks for frontend and backend; CI workflow.
- Deployment configuration, migrations, secrets checklist, rollback procedure, and live smoke tests.

## External dependencies / cannot be completed from source code alone

Live PostgreSQL credentials, Railway service configuration, Billing/CRM/HRMS API contracts and credentials, and n8n instance access/credentials are external dependencies. Code adapters and test fixtures can be prepared without them, but live connectivity and end-to-end verification require those systems to be configured. Do not commit secrets to GitHub or send secrets in chat.
