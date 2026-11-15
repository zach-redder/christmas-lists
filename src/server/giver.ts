/**
 * GIFT-GIVER DATA ACCESS: viewing someone ELSE's list, marking items gotten, secret ideas.
 * Every entry point refuses to operate on the viewer's own list.
 */
import "server-only";
import { aliasedTable, and, asc, count, eq, isNull, ne } from "drizzle-orm";
import type { DB } from "./db-types";
import { fail, OK, type Result } from "./result";
import { claims, items, users, type Price } from "./schema";
import { getUserById, isUuid, type PublicUser } from "./users";
import { validateItem, type ItemInput } from "./validation";

/** Thrown when someone tries to view their own list through the gift-giver side. */
export class OwnListError extends Error {
  constructor() {
    super("You can't view your own list as a gift-giver.");
  }
}

export type FamilyMember = { id: string; name: string; itemCount: number };

export async function listFamily(db: DB, me: string): Promise<FamilyMember[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, itemCount: count(items.id) })
    .from(users)
    .leftJoin(
      items,
      and(eq(items.ownerId, users.id), eq(items.addedById, users.id), isNull(items.deletedAt)),
    )
    .where(ne(users.id, me))
    .groupBy(users.id, users.name, users.nameKey)
    .orderBy(asc(users.nameKey));
  return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) }));
}

export type GiverItem = {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  price: Price | null;
  position: number;
  claim: { claimerName: string; isMine: boolean } | null;
};

export type GiverIdea = GiverItem & { addedByName: string; canEdit: boolean };

export type GiverList = { owner: PublicUser; wishes: GiverItem[]; ideas: GiverIdea[] };

const claimer = aliasedTable(users, "claimer");
const adder = aliasedTable(users, "adder");

export async function getListForGiver(db: DB, viewer: string, ownerId: string): Promise<GiverList | null> {
  if (viewer === ownerId) throw new OwnListError();
  const owner = await getUserById(db, ownerId);
  if (!owner) return null;

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      url: items.url,
      notes: items.notes,
      price: items.price,
      position: items.position,
      addedById: items.addedById,
      addedByName: adder.name,
      claimerId: claims.claimerId,
      claimerName: claimer.name,
    })
    .from(items)
    .leftJoin(claims, eq(claims.itemId, items.id))
    .leftJoin(claimer, eq(claimer.id, claims.claimerId))
    .leftJoin(adder, eq(adder.id, items.addedById))
    .where(and(eq(items.ownerId, ownerId), isNull(items.deletedAt)))
    .orderBy(asc(items.position), asc(items.createdAt));

  const toItem = (r: (typeof rows)[number]): GiverItem => ({
    id: r.id,
    title: r.title,
    url: r.url,
    notes: r.notes,
    price: r.price,
    position: r.position,
    claim: r.claimerId
      ? { claimerName: r.claimerName ?? "Someone", isMine: r.claimerId === viewer }
      : null,
  });

  return {
    owner,
    wishes: rows.filter((r) => r.addedById === ownerId).map(toItem),
    ideas: rows
      .filter((r) => r.addedById !== ownerId)
      .map((r) => ({
        ...toItem(r),
        addedByName: r.addedByName ?? "Someone",
        canEdit: r.addedById === viewer,
      })),
  };
}

const UNAVAILABLE = fail("That item isn't on the list anymore.");

export async function claimItem(db: DB, me: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return UNAVAILABLE;
  const [item] = await db
    .select({ ownerId: items.ownerId, title: items.title, url: items.url, notes: items.notes, price: items.price })
    .from(items)
    .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
  if (!item) return UNAVAILABLE;
  if (item.ownerId === me) return fail("You can't mark items on your own list.");

  const [created] = await db
    .insert(claims)
    .values({
      itemId,
      claimerId: me,
      snapshot: { title: item.title, url: item.url, notes: item.notes, price: item.price },
    })
    .onConflictDoNothing({ target: claims.itemId })
    .returning({ id: claims.id });
  if (created) return OK;

  const [existing] = await db
    .select({ claimerId: claims.claimerId, name: users.name })
    .from(claims)
    .leftJoin(users, eq(users.id, claims.claimerId))
    .where(eq(claims.itemId, itemId));
  if (existing?.claimerId === me) return OK;
  return fail(`Already gotten by ${existing?.name ?? "someone else"}.`);
}

/** Only the person who marked it can undo it. */
export async function unclaimItem(db: DB, me: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return UNAVAILABLE;
  await db.delete(claims).where(and(eq(claims.itemId, itemId), eq(claims.claimerId, me)));
  return OK;
}

export async function addIdea(db: DB, me: string, ownerId: string, input: ItemInput): Promise<Result> {
  if (ownerId === me) return fail("You can't add secret ideas to your own list.");
  if (!(await getUserById(db, ownerId))) return fail("That person wasn't found.");
  const v = validateItem(input);
  if (!v.ok) return fail(v.message);
  await db.insert(items).values({ ...v.item, ownerId, addedById: me });
  return OK;
}

const IDEA_NOT_FOUND = fail("Only the person who added an idea can change it.");

const myIdea = (me: string, itemId: string) =>
  and(eq(items.id, itemId), eq(items.addedById, me), ne(items.ownerId, me), isNull(items.deletedAt));

export async function updateIdea(db: DB, me: string, itemId: string, input: ItemInput): Promise<Result> {
  const v = validateItem(input);
  if (!v.ok) return fail(v.message);
  if (!isUuid(itemId)) return IDEA_NOT_FOUND;
  const updated = await db
    .update(items)
    .set({ ...v.item, updatedAt: new Date() })
    .where(myIdea(me, itemId))
    .returning({ id: items.id });
  return updated.length ? OK : IDEA_NOT_FOUND;
}

export async function deleteIdea(db: DB, me: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return IDEA_NOT_FOUND;
  const deleted = await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(myIdea(me, itemId))
    .returning({ id: items.id });
  return deleted.length ? OK : IDEA_NOT_FOUND;
}
