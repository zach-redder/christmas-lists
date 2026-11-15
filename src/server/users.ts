import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { FamilyId } from "./families";
import type { DB } from "./db-types";
import { normalizeName } from "./names";
import { users } from "./schema";

export type PublicUser = { id: string; name: string };

const publicColumns = { id: users.id, name: users.name };

export async function listUsers(db: DB, family: FamilyId): Promise<PublicUser[]> {
  return db.select(publicColumns).from(users).where(eq(users.family, family)).orderBy(asc(users.nameKey));
}

/** A person in the given family; people from other families are treated as not existing. */
export async function getUserById(db: DB, family: FamilyId, id: string): Promise<PublicUser | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select(publicColumns)
    .from(users)
    .where(and(eq(users.id, id), eq(users.family, family)));
  return row ?? null;
}

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; reason: "taken"; user: PublicUser }
  | { ok: false; reason: "invalid"; message: string };

export async function createUser(
  db: DB,
  family: FamilyId,
  rawName: string,
  pinHash: string | null = null,
): Promise<CreateUserResult> {
  const n = normalizeName(rawName);
  if (!n.ok) return { ok: false, reason: "invalid", message: n.message };

  const [created] = await db
    .insert(users)
    .values({ family, name: n.name, nameKey: n.nameKey, pinHash })
    .onConflictDoNothing({ target: [users.family, users.nameKey] })
    .returning(publicColumns);
  if (created) return { ok: true, user: created };

  const [existing] = await db.select(publicColumns).from(users).where(and(eq(users.family, family), eq(users.nameKey, n.nameKey)));
  return { ok: false, reason: "taken", user: existing };
}

export async function touchUser(db: DB, id: string): Promise<void> {
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
