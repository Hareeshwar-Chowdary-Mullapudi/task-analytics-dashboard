# Task Analytics Dashboard

A PostgreSQL-backed task manager with a built-in analytics dashboard.  
Started as a simple persistent to-do list (Permalist) and extended to track categories, priority, and completion dates — then visualize productivity with real SQL analytics.

---

*Live Demo*:https://task-analytics-dashboard-2k40.onrender.com/

---
## What this project is about

Users can:

- Add, edit, complete, and delete tasks
- Assign a **category** and **priority** (High / Medium / Low)
- Mark tasks complete (keeps history for analytics instead of only deleting)
- View an **Analytics** page with metrics like:
  - Completion rate
  - Average days to finish
  - Tasks completed per day
  - Most productive weekday
  - Category-wise completion
  - High vs low priority completion
  - Daily trend vs previous day
  - Fastest completions per user
  - Monthly productivity

The focus is **practical SQL** — joins, aggregates, CTEs, and window functions.

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Runtime | Node.js (ES modules) |
| Server | Express.js |
| Templates | EJS |
| Database | PostgreSQL |
| DB driver | `pg` (raw SQL, no ORM) |
| Frontend | HTML + CSS (server-rendered) |

**Dependencies:** `express`, `ejs`, `body-parser`, `pg`

---

## Database schema

```
users          → id, name
categories     → id, name
tasks          → id, title, user_id, category_id, priority,
                 created_at, completed_at, is_completed
```

Relationships:

- Each task belongs to one **user**
- Each task belongs to one **category**

---

## How to build & run

### Option A — Supabase (cloud / “global” database)

#### 1. Install dependencies

```bash
cd "8.6 Permalist Project"
npm install
```

#### 2. Create `.env`

Copy the example file:

```bash
copy .env.example .env
```

Open `.env` and set your **database password** (Supabase → **Project Settings** → **Database** → Database password):

```env
DATABASE_URL=postgresql://postgres.qmqjarwipghzaaayouhw:YOUR_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
PORT=3000
```

If your password has special characters (`@`, `#`, `%`, etc.), [URL-encode](https://www.urlencoder.org/) them in the connection string.

#### 3. Create tables in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project  
2. Go to **SQL Editor** → **New query**  
3. Paste the setup SQL from `queries.sql` (CREATE + INSERT, not the commented practice section)  
4. Click **Run**

#### 4. Start the app (local)

```bash
npm run dev
```

Open http://localhost:3000

> You do **not** need the Supabase publishable/anon key for this project — it uses the Postgres connection (`pg`), not the Supabase JS client.  
> `supabase login` / `init` / `link` are optional (CLI only). The steps above are enough.

---

### Option B — Local PostgreSQL

#### Prerequisites

- [Node.js](https://nodejs.org/) installed
- [PostgreSQL](https://www.postgresql.org/) installed and running
- pgAdmin or `psql` to run SQL scripts

#### 1. Clone / open the project

```bash
cd "8.6 Permalist Project"
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Create the database

In pgAdmin or `psql`:

```sql
CREATE DATABASE permalist;
```

#### 4. Run the schema & seed data

Open `queries.sql` and execute it against the `permalist` database.

#### 5. Configure `.env`

```env
DATABASE_URL=postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/permalist
PORT=3000
```

#### 6. Start the server

```bash
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

| Page | URL |
|------|-----|
| Tasks | http://localhost:3000/ |
| Analytics | http://localhost:3000/analytics |

---

## Deploy live (Render + Supabase) — world-accessible

Architecture:

- **Database:** Supabase (already cloud)
- **Web app:** [Render](https://render.com) free Web Service

### 1. Push code to GitHub

Your repo: `https://github.com/Hareeshwar-Chowdary-Mullapudi/task-analytics-dashboard`

```bash
git add .
git commit -m "Prepare app for Render deployment"
git push origin main
```

Do **not** commit `.env` (it is in `.gitignore`).

### 2. Create a Render Web Service

1. Sign up / log in at https://dashboard.render.com with GitHub  
2. **New +** → **Web Service**  
3. Connect the repo `task-analytics-dashboard`  
4. Settings:

| Setting | Value |
|---------|--------|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | Free |

### 3. Add environment variable on Render

**Environment** → **Add Environment Variable**:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Same **Session pooler** URI as in your local `.env` |

Example shape (use your real password):

```text
postgresql://postgres.qmqjarwipghzaaayouhw:YOUR_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### 4. Deploy

Click **Create Web Service**. Wait for the build to finish (green).  
Your live URL looks like:

`https://task-analytics-dashboard-xxxx.onrender.com`

Anyone in the world can open that link.

### Notes

- Free Render apps **sleep after ~15 minutes** idle; first load after sleep can take ~30–60 seconds.  
- Keep using **Session pooler** (not the `db.*` direct host) so Render can reach Supabase over IPv4.  
- Tables must already exist in Supabase (run `queries.sql` once in SQL Editor).

---

## Project structure

```
├── index.js              # Express server + SQL queries
├── queries.sql           # Schema, seed data, practice analytics SQL
├── package.json
├── public/
│   └── styles/main.css
└── views/
    ├── index.ejs         # Task list
    ├── analytics.ejs     # Dashboard
    └── partials/         # Header & footer
```

---

## Key features / project points

1. **CRUD with persistence** — tasks survive server restarts via PostgreSQL.
2. **Normalized schema** — separate `users`, `categories`, and `tasks` tables with foreign keys.
3. **Complete vs delete** — completing a task sets `is_completed` and `completed_at` so analytics stay accurate.
4. **Raw SQL (no ORM)** — all queries use parameterized `$1`, `$2` placeholders for safety.
5. **Analytics with advanced SQL:**
   - `JOIN` — combine tasks with categories/users
   - `GROUP BY` — aggregate by day, category, priority, month
   - `HAVING` — filter groups (e.g. categories with ≥ 2 completions)
   - `RANK()` — rank weekdays by productivity
   - `ROW_NUMBER()` — top N fastest tasks per user
   - `CTE` + `LAG()` — compare each day to the previous day
6. **Interview-friendly** — each analytics block maps to one clear SQL idea (hints shown on the dashboard).
7. **Seed data** — sample completed/pending tasks across multiple days so the dashboard works immediately.

---

## Routes

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/` | Show all tasks |
| `POST` | `/add` | Add a task |
| `POST` | `/edit` | Update task title |
| `POST` | `/complete` | Mark task done |
| `POST` | `/delete` | Remove a task |
| `GET` | `/analytics` | Show analytics dashboard |

---

## License

ISC
