import "server-only";
import { asc, eq } from "drizzle-orm";
import type { DB } from "./db-types";
import { normalizeName } from "./names";
import { users } from "./schema";

export type PublicUser = { id: string; name: string };

const publicColumns = { id: users.id, name: users.name };

export async function listUsers(db: DB): Promise<PublicUser[]> {
  return db.select(publicColumns).from(users).orderBy(asc(users.nameKey));
}

export async function getUserById(db: DB, id: string): Promise<PublicUser | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select(publicColumns).from(users).where(eq(users.id, id));
  return row ?? null;
}

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; reason: "taken"; user: PublicUser }
  | { ok: false; reason: "invalid"; message: string };

export async function createUser(db: DB, rawName: string): Promise<CreateUserResult> {
  const n = normalizeName(rawName);
  if (!n.ok) return { ok: false, reason: "invalid", message: n.message };

  const [created] = await db
    .insert(users)
    .values({ name: n.name, nameKey: n.nameKey })
    .onConflictDoNothing({ target: users.nameKey })
    .returning(publicColumns);
  if (created) return { ok: true, user: created };

  const [existing] = await db.select(publicColumns).from(users).where(eq(users.nameKey, n.nameKey));
  return { ok: false, reason: "taken", user: existing };
}

export async function touchUser(db: DB, id: string): Promise<void> {
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
