-- ============================================================
-- Task Analytics Dashboard - Database Setup
-- Run this in pgAdmin / psql after creating database: permalist
-- ============================================================

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- ---------- 1. Users ----------
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

-- ---------- 2. Categories ----------
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

-- ---------- 3. Tasks ----------
-- priority: High / Medium / Low
-- completed_at is NULL until the task is marked done
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  priority VARCHAR(10) CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
  created_at DATE DEFAULT CURRENT_DATE,
  completed_at DATE,          -- filled when task is completed
  is_completed BOOLEAN DEFAULT FALSE
);

-- ---------- Seed data ----------
INSERT INTO users (name) VALUES
  ('Alex'),
  ('Sam');

INSERT INTO categories (name) VALUES
  ('Work'),
  ('Study'),
  ('Personal'),
  ('Health');

-- Mix of completed + pending tasks across different days
-- (dates are relative so analytics still look good when you run this)
INSERT INTO tasks (title, user_id, category_id, priority, created_at, completed_at, is_completed) VALUES
  ('Finish project report', 1, 1, 'High',   CURRENT_DATE - 10, CURRENT_DATE - 8,  TRUE),
  ('Team meeting notes',    1, 1, 'Medium', CURRENT_DATE - 9,  CURRENT_DATE - 9,  TRUE),
  ('Reply to emails',       1, 1, 'Low',    CURRENT_DATE - 8,  CURRENT_DATE - 7,  TRUE),
  ('Study SQL JOINs',       1, 2, 'High',   CURRENT_DATE - 7,  CURRENT_DATE - 6,  TRUE),
  ('Practice CTEs',         1, 2, 'High',   CURRENT_DATE - 6,  CURRENT_DATE - 5,  TRUE),
  ('Read window functions', 1, 2, 'Medium', CURRENT_DATE - 5,  CURRENT_DATE - 4,  TRUE),
  ('Grocery shopping',      1, 3, 'Low',    CURRENT_DATE - 4,  CURRENT_DATE - 3,  TRUE),
  ('Call parents',          1, 3, 'Medium', CURRENT_DATE - 3,  CURRENT_DATE - 2,  TRUE),
  ('Morning run',           1, 4, 'Medium', CURRENT_DATE - 2,  CURRENT_DATE - 2,  TRUE),
  ('Gym workout',           1, 4, 'High',   CURRENT_DATE - 1,  CURRENT_DATE - 1,  TRUE),
  ('Prepare interview notes', 1, 2, 'High', CURRENT_DATE - 1, NULL, FALSE),
  ('Update resume',           1, 1, 'High', CURRENT_DATE,     NULL, FALSE),
  ('Buy milk',                1, 3, 'Low',  CURRENT_DATE,     NULL, FALSE),
  ('Code review',             2, 1, 'High', CURRENT_DATE - 5, CURRENT_DATE - 4, TRUE),
  ('Write unit tests',        2, 1, 'Medium', CURRENT_DATE - 3, CURRENT_DATE - 1, TRUE),
  ('Yoga session',            2, 4, 'Low',  CURRENT_DATE - 2, NULL, FALSE);

-- ============================================================
-- Interview-ready ANALYTICS QUERIES (for practice / explanation)
-- These same ideas are used in index.js on the /analytics page
-- ============================================================

-- 1) JOIN + GROUP BY : Category-wise completion
-- SELECT c.name, COUNT(*) AS completed
-- FROM tasks t
-- JOIN categories c ON t.category_id = c.id
-- WHERE t.is_completed = TRUE
-- GROUP BY c.name
-- ORDER BY completed DESC;

-- 2) HAVING : Categories with at least 2 completed tasks
-- SELECT c.name, COUNT(*) AS completed
-- FROM tasks t
-- JOIN categories c ON t.category_id = c.id
-- WHERE t.is_completed = TRUE
-- GROUP BY c.name
-- HAVING COUNT(*) >= 2;

-- 3) GROUP BY : Tasks completed per day
-- SELECT completed_at, COUNT(*) AS tasks_done
-- FROM tasks
-- WHERE is_completed = TRUE
-- GROUP BY completed_at
-- ORDER BY completed_at;

-- 4) Completion rate
-- SELECT
--   COUNT(*) AS total_tasks,
--   COUNT(*) FILTER (WHERE is_completed = TRUE) AS completed_tasks,
--   ROUND(
--     100.0 * COUNT(*) FILTER (WHERE is_completed = TRUE) / COUNT(*),
--     1
--   ) AS completion_rate_pct
-- FROM tasks;

-- 5) Average completion time (in days)
-- SELECT ROUND(AVG(completed_at - created_at), 1) AS avg_days
-- FROM tasks
-- WHERE is_completed = TRUE;

-- 6) RANK() : Most productive day of the week
-- SELECT
--   TO_CHAR(completed_at, 'Day') AS weekday,
--   COUNT(*) AS tasks_done,
--   RANK() OVER (ORDER BY COUNT(*) DESC) AS productivity_rank
-- FROM tasks
-- WHERE is_completed = TRUE
-- GROUP BY TO_CHAR(completed_at, 'Day');

-- 7) High vs Low priority completion
-- SELECT priority, COUNT(*) AS completed
-- FROM tasks
-- WHERE is_completed = TRUE
-- GROUP BY priority
-- ORDER BY completed DESC;

-- 8) CTE + LAG() : Daily trend vs previous day
-- WITH daily AS (
--   SELECT completed_at AS day, COUNT(*) AS tasks_done
--   FROM tasks
--   WHERE is_completed = TRUE
--   GROUP BY completed_at
-- )
-- SELECT
--   day,
--   tasks_done,
--   LAG(tasks_done) OVER (ORDER BY day) AS previous_day,
--   tasks_done - LAG(tasks_done) OVER (ORDER BY day) AS change_from_prev
-- FROM daily
-- ORDER BY day;

-- 9) ROW_NUMBER() : Rank each user's completed tasks by speed
-- SELECT
--   u.name,
--   t.title,
--   (t.completed_at - t.created_at) AS days_taken,
--   ROW_NUMBER() OVER (
--     PARTITION BY u.id
--     ORDER BY (t.completed_at - t.created_at)
--   ) AS speed_rank
-- FROM tasks t
-- JOIN users u ON t.user_id = u.id
-- WHERE t.is_completed = TRUE;
