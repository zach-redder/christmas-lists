/**
 * OWNER-SAFE DATA ACCESS.
 * Everything a person can see or do with their OWN list lives here.
 * This module must never read gift-giver data (who marked what as gotten) or secret ideas,
 * and a test fails if it so much as mentions that table.
 * Every function returns the same shape whether or not anyone has marked an item.
 */
import "server-only";
import { and, asc, eq, isNull, max } from "drizzle-orm";
import type { DB } from "./db-types";
import { fail, OK, type Result } from "./result";
import { items, type Price } from "./schema";
import { isUuid } from "./users";
import { validateItem, type ItemInput } from "./validation";

export type OwnerItem = {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  price: Price | null;
  position: number;
};

const NOT_FOUND = fail("That wish wasn't found. It may have been removed.");

const ownWishes = (me: string) =>
  and(eq(items.ownerId, me), eq(items.addedById, me), isNull(items.deletedAt));

export async function getMyItems(db: DB, me: string): Promise<OwnerItem[]> {
  return db
    .select({
      id: items.id,
      title: items.title,
      url: items.url,
      notes: items.notes,
      price: items.price,
      position: items.position,
    })
    .from(items)
    .where(ownWishes(me))
    .orderBy(asc(items.position), asc(items.createdAt));
}

export async function addMyItem(db: DB, me: string, input: ItemInput): Promise<Result> {
  const v = validateItem(input);
  if (!v.ok) return fail(v.message);
  const [{ top }] = await db.select({ top: max(items.position) }).from(items).where(ownWishes(me));
  await db.insert(items).values({ ...v.item, ownerId: me, addedById: me, position: (top ?? -1) + 1 });
  return OK;
}

export async function updateMyItem(db: DB, me: string, itemId: string, input: ItemInput): Promise<Result> {
  const v = validateItem(input);
  if (!v.ok) return fail(v.message);
  if (!isUuid(itemId)) return NOT_FOUND;
  const updated = await db
    .update(items)
    .set({ ...v.item, updatedAt: new Date() })
    .where(and(eq(items.id, itemId), ownWishes(me)))
    .returning({ id: items.id });
  return updated.length ? OK : NOT_FOUND;
}

/** Always a soft delete, so it behaves identically no matter what gift-givers have done. */
export async function deleteMyItem(db: DB, me: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return NOT_FOUND;
  const deleted = await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, itemId), ownWishes(me)))
    .returning({ id: items.id });
  return deleted.length ? OK : NOT_FOUND;
}

export type Move = "up" | "down" | "top";

export async function moveMyItem(db: DB, me: string, itemId: string, move: Move): Promise<Result> {
  if (!isUuid(itemId)) return NOT_FOUND;
  return db.transaction(async (tx) => {
    const list = await tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(ownWishes(me))
      .orderBy(asc(items.position), asc(items.createdAt));
    const from = list.findIndex((i) => i.id === itemId);
    if (from === -1) return NOT_FOUND;

    const to =
      move === "top" ? 0 : move === "up" ? Math.max(0, from - 1) : Math.min(list.length - 1, from + 1);
    const order = [...list];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);

    for (const [position, item] of order.entries()) {
      if (item.position !== position) {
        await tx.update(items).set({ position }).where(eq(items.id, item.id));
      }
    }
    return OK;
  });
}
