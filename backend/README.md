# CareX Backend

Production-grade REST API for **CareX**, a doctor-appointment / healthcare app.
Node.js + Express + MongoDB (Mongoose), JWT auth with role-based access control
(patient / doctor / admin), Cloudinary uploads, and Razorpay payments.

> This replaces the old insecure, backend-less setup where the frontend talked
> directly to Firebase. All business logic and data ownership now live here.

---

## Tech stack

- **Runtime:** Node.js (LTS), ES modules
- **Framework:** Express
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (access + refresh), bcryptjs, role-based access control
- **Validation:** Zod
- **Uploads:** Cloudinary (multer) — _added in a later phase_
- **Payments:** Razorpay — _added in a later phase_
- **Security:** helmet, CORS, express-rate-limit, express-mongo-sanitize, hpp
- **Logging:** morgan + winston
- **Tests:** Jest + Supertest (mongodb-memory-server) — _added in a later phase_

## Architecture

Layered flow: **routes → controllers → services → models**. Controllers stay
thin; business logic lives in services.

```
src/
├── config/        # env loading + DB connection
├── models/        # Mongoose schemas
├── controllers/   # thin HTTP handlers
├── services/      # business logic
├── routes/        # Express routers (mounted in routes/index.js)
├── middlewares/   # auth, error handling, 404, validation
├── validators/    # Zod schemas
├── utils/         # ApiError, asyncHandler, ApiResponse, logger
├── seed/          # seed scripts (e.g. admin)
├── app.js         # builds + configures the Express app (no listen)
└── server.js      # loads env, connects Mongo, starts server, graceful shutdown
```

Every response uses the same shape:

```json
{ "success": true, "message": "string", "data": {} }
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB instance (local `mongod`, Docker, or MongoDB Atlas)

### Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values
```

Fill in `.env` (see `.env.example` for the full list):

| Variable             | Description                                   |
| -------------------- | --------------------------------------------- |
| `PORT`               | Port the API listens on (default `5000`)      |
| `NODE_ENV`           | `development` \| `production` \| `test`       |
| `MONGO_URI`          | MongoDB connection string                     |
| `CLIENT_ORIGIN`      | Allowed frontend origin for CORS              |
| `JWT_ACCESS_SECRET`  | Secret for signing short-lived access tokens  |
| `JWT_REFRESH_SECRET` | Secret for signing long-lived refresh tokens  |
| `JWT_ACCESS_EXPIRY`  | Access token lifetime (e.g. `15m`)            |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime (e.g. `7d`)            |

### Run

```bash
npm run dev     # start with nodemon (auto-reload)
npm start       # start once (node)
npm test        # run the test suite (added in a later phase)
```

### Verify it's up

```bash
curl http://localhost:5000/api/health
# → { "success": true, "message": "CareX API healthy", "data": { ... } }
```

---

## Conventions

- **Errors:** throw `ApiError(statusCode, message)`; wrap async handlers with
  `asyncHandler`; everything resolves in the global error middleware. No stack
  traces leak when `NODE_ENV=production`.
- **Secrets:** only via environment variables. `.env` is git-ignored; keep
  `.env.example` complete and truthful.
- **Security:** passwords and refresh tokens are never returned in responses;
  identity is derived from the verified token; ownership is re-checked on every
  protected resource.

> Build order is phased — see `CareX_Backend_Build_Prompts.md`. Do not skip
> phases; later phases assume earlier ones exist.
