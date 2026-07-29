import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dns from "node:dns";
import { resolve6 } from "node:dns/promises";

const app = express();
const port = process.env.PORT || 3000;

// Prefer public DNS so Supabase IPv6 hostnames resolve on Windows
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Build DB config. Supabase "direct" host is often IPv6-only;
// Windows then throws ENOTFOUND — resolve AAAA and connect by IP.
async function createDbClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file.");
  }

  const useSsl = connectionString.includes("supabase");
  let config = {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };

  const hostMatch = connectionString.match(/@([^:/?\[]+)/);
  const host = hostMatch?.[1];

  if (host?.startsWith("db.") && host.endsWith(".supabase.co")) {
    try {
      const ipv6 = await resolve6(host);
      if (ipv6[0]) {
        config = {
          connectionString: connectionString.replace(
            `@${host}`,
            `@[${ipv6[0]}]`
          ),
          ssl: {
            rejectUnauthorized: false,
            servername: host,
          },
        };
        console.log("Using Supabase IPv6 address (direct connection).");
      }
    } catch (err) {
      console.error("Could not resolve Supabase host:", err.message);
      console.error(
        "In Supabase → Database → Connection string, copy Session pooler URI into .env instead."
      );
    }
  }

  return new pg.Client(config);
}

const db = await createDbClient();
try {
  await db.connect();
  console.log("Database connected.");
} catch (err) {
  console.error("Database connection failed:", err.message);
  console.error("Check DATABASE_URL in your .env file.");
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// ---------- TASK LIST ----------
app.get("/", async (req, res) => {
  try {
    const tasksResult = await db.query(
      `SELECT t.id, t.title, t.priority, t.is_completed, t.created_at,
              c.name AS category
       FROM tasks t
       LEFT JOIN categories c ON t.category_id = c.id
       ORDER BY t.is_completed ASC, t.id DESC`
    );
    const categoriesResult = await db.query(
      "SELECT * FROM categories ORDER BY name"
    );

    res.render("index.ejs", {
      listTitle: "My Tasks",
      listItems: tasksResult.rows,
      categories: categoriesResult.rows,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Database error. Did you run queries.sql?");
  }
});

app.post("/add", async (req, res) => {
  const { newItem, categoryId, priority } = req.body;
  try {
    // Default user_id = 1 (Alex) — keeps the demo simple for interviews
    await db.query(
      `INSERT INTO tasks (title, user_id, category_id, priority)
       VALUES ($1, 1, $2, $3)`,
      [newItem, categoryId, priority || "Medium"]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.post("/edit", async (req, res) => {
  const { updatedItemId, updatedItemTitle } = req.body;
  try {
    await db.query("UPDATE tasks SET title = $1 WHERE id = $2", [
      updatedItemTitle,
      updatedItemId,
    ]);
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

// Mark complete (keeps row for analytics) instead of deleting
app.post("/complete", async (req, res) => {
  const id = req.body.completeItemId;
  try {
    await db.query(
      `UPDATE tasks
       SET is_completed = TRUE, completed_at = CURRENT_DATE
       WHERE id = $1`,
      [id]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.post("/delete", async (req, res) => {
  const id = req.body.deleteItemId;
  try {
    await db.query("DELETE FROM tasks WHERE id = $1", [id]);
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

// ---------- ANALYTICS DASHBOARD ----------
app.get("/analytics", async (req, res) => {
  try {
    // 1) Completion rate
    const completionRate = await db.query(`
      SELECT
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE is_completed = TRUE) AS completed_tasks,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE is_completed = TRUE) / NULLIF(COUNT(*), 0),
          1
        ) AS completion_rate_pct
      FROM tasks
    `);

    // 2) Average completion time (days)
    const avgTime = await db.query(`
      SELECT ROUND(AVG(completed_at - created_at), 1) AS avg_days
      FROM tasks
      WHERE is_completed = TRUE
    `);

    // 3) Tasks completed per day  (GROUP BY)
    const perDay = await db.query(`
      SELECT completed_at AS day, COUNT(*) AS tasks_done
      FROM tasks
      WHERE is_completed = TRUE
      GROUP BY completed_at
      ORDER BY completed_at
    `);

    // 4) Most productive weekday  (GROUP BY + RANK)
    const productiveDay = await db.query(`
      SELECT
        TRIM(TO_CHAR(completed_at, 'Day')) AS weekday,
        COUNT(*) AS tasks_done,
        RANK() OVER (ORDER BY COUNT(*) DESC) AS productivity_rank
      FROM tasks
      WHERE is_completed = TRUE
      GROUP BY TRIM(TO_CHAR(completed_at, 'Day'))
      ORDER BY productivity_rank
    `);

    // 5) Category-wise completion  (JOIN + GROUP BY + HAVING)
    const byCategory = await db.query(`
      SELECT c.name AS category, COUNT(*) AS completed
      FROM tasks t
      JOIN categories c ON t.category_id = c.id
      WHERE t.is_completed = TRUE
      GROUP BY c.name
      HAVING COUNT(*) >= 2
      ORDER BY completed DESC
    `);

    // 6) High vs Low priority completion  (GROUP BY)
    const byPriority = await db.query(`
      SELECT priority, COUNT(*) AS completed
      FROM tasks
      WHERE is_completed = TRUE
      GROUP BY priority
      ORDER BY
        CASE priority
          WHEN 'High' THEN 1
          WHEN 'Medium' THEN 2
          WHEN 'Low' THEN 3
        END
    `);

    // 7) Daily trend with previous day  (CTE + LAG)
    const dailyTrend = await db.query(`
      WITH daily AS (
        SELECT completed_at AS day, COUNT(*) AS tasks_done
        FROM tasks
        WHERE is_completed = TRUE
        GROUP BY completed_at
      )
      SELECT
        day,
        tasks_done,
        LAG(tasks_done) OVER (ORDER BY day) AS previous_day,
        tasks_done - LAG(tasks_done) OVER (ORDER BY day) AS change_from_prev
      FROM daily
      ORDER BY day
    `);

    // 8) Fastest completed tasks per user  (JOIN + ROW_NUMBER)
    const fastestTasks = await db.query(`
      SELECT *
      FROM (
        SELECT
          u.name AS user_name,
          t.title,
          (t.completed_at - t.created_at) AS days_taken,
          ROW_NUMBER() OVER (
            PARTITION BY u.id
            ORDER BY (t.completed_at - t.created_at), t.id
          ) AS speed_rank
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        WHERE t.is_completed = TRUE
      ) ranked
      WHERE speed_rank <= 3
      ORDER BY user_name, speed_rank
    `);

    // 9) Monthly productivity  (GROUP BY month)
    const monthly = await db.query(`
      SELECT
        TO_CHAR(completed_at, 'YYYY-MM') AS month,
        COUNT(*) AS tasks_done
      FROM tasks
      WHERE is_completed = TRUE
      GROUP BY TO_CHAR(completed_at, 'YYYY-MM')
      ORDER BY month
    `);

    res.render("analytics.ejs", {
      completionRate: completionRate.rows[0],
      avgDays: avgTime.rows[0].avg_days,
      perDay: perDay.rows,
      productiveDay: productiveDay.rows,
      byCategory: byCategory.rows,
      byPriority: byPriority.rows,
      dailyTrend: dailyTrend.rows,
      fastestTasks: fastestTasks.rows,
      monthly: monthly.rows,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Database error. Did you run queries.sql?");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
