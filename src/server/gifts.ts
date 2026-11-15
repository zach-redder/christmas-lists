/**
 * "MY GIFTS": everything the signed-in person has marked as gotten for OTHER people,
 * plus notices when an owner changed or removed something after it was marked.
 */
import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "./db-types";
import { fail, OK, type Result } from "./result";
import { claims, items, users, type ItemSnapshot, type Price } from "./schema";
import { isUuid, type PublicUser } from "./users";

export type Change = { field: "title" | "url" | "notes" | "price"; before: string | null; after: string | null };

export type MyGift = {
  itemId: string;
  title: string;
  url: string | null;
  notes: string | null;
  price: Price | null;
  isIdea: boolean;
  status: "ok" | "changed" | "removed";
  changes: Change[];
};

export type GiftGroup = { person: PublicUser; gifts: MyGift[] };

const FIELDS: Change["field"][] = ["title", "url", "notes", "price"];

function diff(before: ItemSnapshot, after: ItemSnapshot): Change[] {
  return FIELDS.filter((f) => (before[f] ?? null) !== (after[f] ?? null)).map((field) => ({
    field,
    before: before[field] ?? null,
    after: after[field] ?? null,
  }));
}

export async function getMyGifts(db: DB, me: string): Promise<GiftGroup[]> {
  const rows = await db
    .select({
      itemId: items.id,
      title: items.title,
      url: items.url,
      notes: items.notes,
      price: items.price,
      ownerId: items.ownerId,
      addedById: items.addedById,
      deletedAt: items.deletedAt,
      ownerName: users.name,
      snapshot: claims.snapshot,
    })
    .from(claims)
    .innerJoin(items, eq(items.id, claims.itemId))
    .innerJoin(users, eq(users.id, items.ownerId))
    .where(and(eq(claims.claimerId, me), isNull(claims.dismissedAt)))
    .orderBy(asc(users.nameKey), asc(items.position), asc(items.createdAt));

  const groups = new Map<string, GiftGroup>();
  for (const r of rows) {
    const current: ItemSnapshot = { title: r.title, url: r.url, notes: r.notes, price: r.price };
    const changes = r.deletedAt ? [] : diff(r.snapshot, current);
    const gift: MyGift = {
      itemId: r.itemId,
      ...current,
      isIdea: r.addedById !== r.ownerId,
      status: r.deletedAt ? "removed" : changes.length ? "changed" : "ok",
      changes,
    };
    const group = groups.get(r.ownerId) ?? { person: { id: r.ownerId, name: r.ownerName }, gifts: [] };
    group.gifts.push(gift);
    groups.set(r.ownerId, group);
  }
  return [...groups.values()];
}

/** "Got it": the claimer has seen the owner's edits, so stop flagging them. */
export async function acknowledgeChange(db: DB, me: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return OK;
  const [item] = await db
    .select({ title: items.title, url: items.url, notes: items.notes, price: items.price })
    .from(items)
    .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
  if (!item) return fail("That item isn't on the list anymore.");
  await db
    .update(claims)
    .set({ snapshot: item })
    .where(and(eq(claims.itemId, itemId), eq(claims.claimerId, me)));
  return OK;
}

/** Hide the "removed by owner" notice for an item the claimer had marked. */
export async function dismissRemoved(db: DB, me: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return OK;
  const [item] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), isNotNull(items.deletedAt)));
  if (!item) return OK;
  await db
    .update(claims)
    .set({ dismissedAt: new Date() })
    .where(and(eq(claims.itemId, itemId), eq(claims.claimerId, me)));
  return OK;
}
