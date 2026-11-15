/**
 * Applies drizzle/ migrations to the Neon database. Runs before `next build` on Vercel.
 * Without DATABASE_URL (local dev), it skips: the local PGlite database migrates itself on startup.
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set, skipping (local PGlite migrates on startup).");
    return;
  }
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    console.log("[migrate] Database is up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
