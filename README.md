# Event Reservation System

A production-grade REST API for event reservations, built with Express 5, TypeScript, PostgreSQL, and Redis. Designed to demonstrate real backend engineering patterns: transactional integrity, background job processing, secure authentication, and integration testing.

> **Focus areas:** concurrency control, distributed background jobs, token-based auth with rotation, and containerized deployment.

---

## Architecture
┌─────────────┐ HTTPS ┌──────────────────────────────────┐
│ Client │ ─────────────► │ Express 5 (API) │
└─────────────┘ │ Route → Controller → Service │
└──┬───────────┬────────────┬──────┘
│ │ │
┌───────▼──┐ ┌────▼─────┐ ┌───▼────┐
│ Postgres │ │ Redis │ │ BullMQ │
│ (Prisma) │ │ (cache, │ │ Queue │
│ │ │ rate │ │ │
│ │ │ limit) │ │ │
└──────────┘ └──────────┘ └───┬────┘
│
┌────▼─────┐
│ Worker │
│ (jobs) │
└──────────┘

text

**Layers:**
- **Route** — attaches validation and auth middleware, dispatches to controller.
- **Controller** — HTTP concerns: parses request, calls service, shapes response.
- **Service** — business logic and database access. All transactions live here.
- **Prisma** — type-safe PostgreSQL client.

**Cross-cutting middleware:**
- `validate` — Zod schemas for body, params, and query. Collects all errors into one structured response.
- `authenticate` — verifies JWT access token, attaches `req.user`.
- `authorizeRoles(...roles)` — RBAC gate. Returns 403 if role mismatch.
- `errorMiddleware` — single translation layer for `AppError` and Prisma errors (P2025, P2002, P2003, P2000).
- Rate limiters — Redis-backed, separate limits for auth endpoints vs. general API.

---

## Tech Stack

| Category | Tools |
|---|---|
| Runtime | Node.js, TypeScript (ESM + NodeNext), Express 5 |
| Database | PostgreSQL, Prisma ORM |
| Caching & Queues | Redis, BullMQ |
| Auth | JWT (access + refresh rotation), bcrypt, HttpOnly cookies |
| Validation | Zod |
| Testing | Vitest, Supertest |
| Containerization | Docker (multi-stage build), Docker Compose |
| Load Testing | k6 |

---

## Hard Problems Solved

### 1. Preventing ticket overbooking under concurrent load

**Problem:** A naive `read → check → write` inside a Prisma transaction allows multiple concurrent requests to read the same `availableTickets` count, all pass the check, and all decrement — resulting in negative inventory.

**Solution:** Pessimistic row locking with `SELECT ... FOR UPDATE` inside the transaction. The first request to arrive acquires the row lock; concurrent requests for the same event queue up behind it. When each acquires the lock, it re-reads the current count and either succeeds or rejects with `Event is full`.

```sql
SELECT id, "availableTickets" FROM "Event" WHERE id = $1 FOR UPDATE
This also serializes against the event update endpoint, so admin ticket changes and reservations can't corrupt each other.

2. Refresh token rotation with theft detection
Access tokens are short-lived (15 min). Refresh tokens are long-lived (7 days) and stored hashed in the database. Every refresh rotates the token — the old one is immediately marked revoked, and a new one is issued in the same familyId.

If a revoked token is ever used again, it means the token was stolen and replayed. The system revokes the entire token family, forcing re-authentication across all devices for that user.

3. Reliable background job processing
Reservation confirmations and scheduled token cleanup are offloaded to BullMQ queues. Jobs are configured with retry attempts and exponential backoff. Workers run in the same process group but are logically decoupled — a worker crash doesn't affect API availability, and vice versa.

4. Structured validation errors
Zod validation errors are normalized into a consistent shape that a frontend can map directly to form fields:

json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "body.email", "message": "Invalid email" },
    { "field": "body.password", "message": "Password must be at least 8 characters" }
  ]
}
5. Account lockout with enumeration resistance
After 5 failed login attempts, the account is locked for 15 minutes. The lockout check runs before password comparison — both to avoid bcrypt CPU cost during a brute-force attack and to short-circuit without a DB write. Login failures return an identical Invalid credentials message whether the email doesn't exist or the password is wrong, preventing email enumeration.

API Overview
Auth (/api/auth)
Method	Path	Description	Auth
POST	/register	Create account	Public
POST	/login	Issue access + refresh tokens	Public (rate limited)
POST	/refresh	Rotate refresh token	Cookie
POST	/logout	Revoke session family	Cookie
POST	/send-verification	Send email verification link	Bearer
GET	/verify-email	Consume verification token	Public
POST	/forgot-password	Send password reset link	Public (rate limited)
POST	/reset-password	Consume reset token, revoke all sessions	Public
Sessions (/api/auth/sessions)
Method	Path	Description
GET	/	List active sessions with isCurrent flag
DELETE	/	Revoke all sessions except current
DELETE	/:id	Revoke a specific session
Events (/api/events)
Method	Path	Description	Auth
GET	/:id	Get event by ID	Public
POST	/create	Create event	ADMIN
PUT	/update/:id	Update event	ADMIN
DELETE	/:id	Delete event (blocked if reservations exist)	ADMIN
Reservations (/api/reservation)
Method	Path	Description	Auth
POST	/	Reserve a ticket	Bearer
GET	/me	List current user's reservations	Bearer
DELETE	/:id	Cancel reservation	Bearer
Running Locally
Prerequisites
Docker and Docker Compose

Node.js 20+

With Docker Compose (recommended)
bash
git clone https://github.com/adnan4498/event-reservation-system.git
cd event-reservation-system
cp .env.example .env   # fill in your values
docker compose up --build
API is available at http://localhost:3000.

Without Docker
bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
Requires a local PostgreSQL and Redis instance.

Environment Variables
env
DATABASE_URL="postgresql://user:password@localhost:5432/event_api"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-long-random-secret"
JWT_EXPIRES_IN="15m"
SMTP_HOST="..."
SMTP_PORT="..."
SMTP_USER="..."
SMTP_PASS="..."
EMAIL_FROM="noreply@yourapp.com"
APP_URL="http://localhost:3000"
NODE_ENV="development"
Testing
Integration tests use Vitest + Supertest, running against a separate PostgreSQL database that is truncated between test files.

bash
npm test
Coverage:

Auth (9 tests): registration, login, duplicate email, account lockout state machine

Sessions (9 tests): token rotation, replay detection, session listing, revocation ownership

Email flows (10 tests): verification token lifecycle, single-use enforcement, mail failure rollback, password reset atomicity

Events & RBAC (16 tests): role enforcement, event CRUD, partial update validation, ticket adjustment under concurrent sales

44 tests total. All external services (mailer, Redis, BullMQ) are mocked so tests are deterministic and fast.

Project Structure
text
src/
├── controllers/      # HTTP layer
├── services/         # Business logic + DB
├── routes/           # Route definitions
├── middleware/       # Auth, validation, error, rate limiting
├── validators/       # Zod schemas
├── errors/           # AppError class
├── lib/              # Prisma, JWT, Redis, Mailer
├── workers/          # BullMQ workers
└── tests/
    ├── integration/  # Vitest + Supertest suites
    └── helpers/      # DB reset, test client
prisma/
├── schema.prisma
└── migrations/
Design Decisions & Trade-offs
Prisma over raw SQL — chosen for type safety and migration workflow. Raw SQL still used where Prisma's query builder can't express the intent (row-level locking).

Decimal for price — never Float. Money needs exact arithmetic.

Denormalized availableTickets — computed as totalTickets - soldCount at write time under a row lock, rather than a COUNT(*) on every read. Faster and safely consistent because all writes go through the same lock.

One test database per run — the suite truncates tables between files. Guarantees isolation at the cost of ~30s of runtime.

BullMQ worker in the same process — simplest for a portfolio project. In production, workers would run as separate processes behind the same Redis instance.