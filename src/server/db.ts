import "server-only";
import type { DB } from "./db-types";
import * as schema from "./schema";

// Cached on globalThis so dev hot-reloads and warm Fluid Compute instances reuse one connection.
const globalForDb = globalThis as unknown as { __redderDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  globalForDb.__redderDb ??= connect();
  return globalForDb.__redderDb;
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    return drizzle(new Pool({ connectionString: url }), { schema }) as unknown as DB;
  }

  // No DATABASE_URL: use an on-disk PGlite database so the app runs locally with zero setup.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DB !== "1") {
    throw new Error("DATABASE_URL is not set. Connect a Neon database in the Vercel dashboard.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(process.env.PGLITE_DIR ?? ".pglite"), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as DB;
}
