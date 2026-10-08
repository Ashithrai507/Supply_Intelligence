# Supabase Docker Setup & Backend Integration Guide

This guide provides instructions for developers and AI agents to spin up the local Dockerized Supabase stack, apply database migrations and seed data, and connect both the FastAPI backend and Vite frontend.

---

## 1. Prerequisites

- **Docker Desktop** running on the host machine (`docker info` should return successfully).
- **Node.js & npm** (`npx` available to run the Supabase CLI).
- **Python 3.11+ virtual environment** configured at `backend/.venv`.

---

## 2. Supabase Architecture in this Repository



The local Supabase configuration lives inside the `supabase/` folder:
- `supabase/config.toml`: Project settings, listening ports, enabled services (DB, Auth, Studio, Storage, PostgREST).
- `supabase/migrations/`: SQL migration files automatically applied in chronological order on startup.
- `supabase/seed.sql`: Baseline demo records (hospitals, medicines, batches, suppliers, orders).

---

## 3. Starting the Supabase Docker Containers

Run the following command from the repository root:

```bash
npx supabase start
```

### What this does:
1. Pulls and launches all necessary Docker containers under project prefix `supabase_*_supply-intelligence`:
   - `supabase_db`: PostgreSQL 15 database (`127.0.0.1:54322`)
   - `supabase_kong`: API Gateway (`http://127.0.0.1:54321`)
   - `supabase_rest`: PostgREST REST API
   - `supabase_auth`: GoTrue Auth service
   - `supabase_studio`: Web management UI (`http://127.0.0.1:54323`)
   - `supabase_inbucket`: Local test email inbox (`http://127.0.0.1:54324`)
   - `supabase_storage`, `supabase_realtime`, `supabase_edge_runtime`
2. Applies all migrations in `supabase/migrations/`.
3. Runs `supabase/seed.sql`.

---

## 4. Default Connection Details & Ports

| Service | Port / URL | Credentials / Key |
| :--- | :--- | :--- |
| **Postgres Database** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | User: `postgres`, Password: `postgres` |
| **Supabase Studio (UI)** | [http://127.0.0.1:54323](http://127.0.0.1:54323) | Open in any web browser |
| **API Gateway (Kong)** | `http://127.0.0.1:54321` | Routes PostgREST, Auth, and Storage |
| **REST API (PostgREST)** | `http://127.0.0.1:54321/rest/v1` | Requires `apikey` header |
| **Auth Service (GoTrue)** | `http://127.0.0.1:54321/auth/v1` | User sign up / JWT issuing |
| **Local Mailbox (Inbucket)**| [http://127.0.0.1:54324](http://127.0.0.1:54324) | View confirmation emails |

### Standard Local JWTs & Keys:
- **Anon Key (Public)**:
  ```text
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
  ```
- **Service Role Key (Secret)**:
  ```text
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
  ```
- **JWT Secret**:
  ```text
  super-secret-jwt-token-with-at-least-32-characters-long
  ```

---

## 5. Connecting the Backend (FastAPI)

The backend uses `SQLAlchemy` and `psycopg` to connect to PostgreSQL.

### Step 5.1: Create Root `.env`
Ensure the file `.env` exists in the repository root with these values:

```env
# Backend (FastAPI) — connected to local Docker Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
LLM_API_KEY=
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176
ENVIRONMENT=development

# Frontend (Vite)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
VITE_API_BASE_URL=http://localhost:8000
```

### Step 5.2: Start the Backend Server
From the repository root:
```bash
backend/.venv/bin/uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8000
```
Or from within the `backend/` directory:
```bash
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify backend health:
```bash
curl http://localhost:8000/health
```

---

## 6. Connecting the Frontend (Vite)

In `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

Start the frontend server:
```bash
cd frontend && npm run dev
```

---

## 7. Useful Supabase CLI & Maintenance Commands

### Check status of all containers:
```bash
npx supabase status
```

### View container logs:
```bash
docker logs -f supabase_db_supply-intelligence
```

### Stop Supabase:
```bash
npx supabase stop
```

### Stop Supabase and delete volumes/database data:
```bash
npx supabase stop --no-backup
```

### Reset database and re-run all migrations + seed:
```bash
npx supabase db reset
```

---

## 8. Common Gotchas & Troubleshooting

1. **`VALUES lists must all be the same length (SQLSTATE 42601)` during seed**:
   Ensure every row in `supabase/seed.sql` has the exact same number of columns defined in the table schema.
2. **CORS error / `Failed to fetch` in browser**:
   If the Vite dev server binds to a non-standard port (e.g. `5174` or `5175`), ensure `CORSMiddleware` in `backend/app/main.py` has regex origin matching enabled (`allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"`).
3. **Missing container error on status check**:
   If `supabase status` complains about a missing container, run `npx supabase start` to restart any halted containers.
