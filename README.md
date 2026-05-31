# CP Vault — Full-Stack

Competitive programming tracker migrated from a single-page `localStorage` app to **Node.js + Express + PostgreSQL + JWT**.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite + original CP Vault UI |
| Backend | Express 4 |
| Database | PostgreSQL 16 |
| Auth | JWT + bcrypt password hashing |

## Features

- User **registration**, **login**, **logout**
- Per-user data: **profile**, **platform handles**, **problems**, **notes**, **classifications**, **revision** sessions/history, **contests**, **contest history**, **upsolve** queue
- **Admin** role: list all users (`GET /api/admin/users`)
- **Import** legacy `localStorage` (`cpvault_v4`, `cpv_cf`, `cpv_lc`, `cpv_at`)
- **Contest performance** — log live solves vs upsolves, platform breakdown, upsolve rate

## Deploy (Vercel + Render + Neon + UptimeRobot)

Step-by-step: **[DEPLOY_RENDER_VERCEL_NEON.md](DEPLOY_RENDER_VERCEL_NEON.md)**

## Quick start (local dev)

### 1. PostgreSQL

```bash
docker compose up -d postgres
```

Or use your own Postgres and set `DATABASE_URL` in `backend/.env`.

### 2. Backend

```bash
cp backend/.env.example backend/.env
cd backend && npm install && npm run db:init && npm run dev
```

API: `http://localhost:3001`

### 3. Frontend (development)

```bash
cd frontend && npm install && npm run dev
```

App: `http://localhost:5173` (proxies `/api` to the backend)

### 4. Production-style (API serves built frontend)

```bash
cd frontend && npm run build
cd ../backend && npm start
```

Open `http://localhost:3001`

## Create an admin user

Register normally, then promote in Postgres:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## API routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/logout` | Logout (client clears token) |
| GET | `/api/auth/me` | Current user |
| GET/PUT | `/api/data` | Load/save full app state |
| POST | `/api/data/import-local` | Import `cpvault_v4` JSON |
| GET/PUT | `/api/profile` | User profile |
| GET/PUT | `/api/handles` | CF / LC / AtCoder handles |
| GET/POST/PUT/DELETE | `/api/problems` | Problems CRUD |
| GET/POST/PUT/DELETE | `/api/notes` | Notes CRUD |
| GET/POST/PATCH | `/api/revision` | Revision session |
| GET/PUT | `/api/contests` | Contests + last fetched |
| GET/POST | `/api/contests/history` | Past contests |
| GET/POST/PATCH/DELETE | `/api/upsolve` | Upsolve queue |
| GET | `/api/admin/users` | Admin: list users |
| GET | `/api/admin/users/:id` | Admin: user detail |
| GET | `/api/contests/analytics` | Contest performance summary |

## Database schema (localStorage → tables)

| localStorage | Table(s) |
|--------------|----------|
| `cpvault_v4.problems` | `problems` |
| `cpvault_v4.notes` | `notes` |
| `cpvault_v4.contests` | `user_contests` |
| `cpvault_v4.upsolveProblems` | `upsolve_problems` |
| `cpvault_v4.revisionProblems` + `revisionGeneratedAt` | `revision_sessions`, `revision_items` |
| `cpvault_v4.revisionHistory` | `revision_history` |
| `cpvault_v4.contestHistory` | `contest_history` |
| `cpvault_v4.contestsLastFetched` | `user_settings` |
| `cpv_cf`, `cpv_lc`, `cpv_at` | `platform_handles` |
| (new) | `profiles`, `users` |
| `cpvault_v4.contestPerformances` | `contest_performances` |

Schema file: `backend/src/db/schema.sql`

## Environment

See `backend/.env.example`:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — signing secret (change in production)
- `JWT_EXPIRES_IN` — e.g. `7d`
- `CORS_ORIGIN` — frontend origin for dev (`http://localhost:5173`)
