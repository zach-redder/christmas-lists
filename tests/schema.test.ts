import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { claims, items, users } from "@/server/schema";

describe("schema constraints", () => {
  it("rejects two users with the same name key", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ name: "Mom", nameKey: "mom" });
    await expect(db.insert(users).values({ name: "MOM", nameKey: "mom" })).rejects.toThrow();
  });

  it("rejects a second claim on the same item", async () => {
    const db = await createTestDb();
    const itemId = crypto.randomUUID();
    const snapshot = { title: "x", url: null, notes: null, price: null };
    await db.insert(claims).values({ itemId, claimerId: crypto.randomUUID(), snapshot });
    await expect(
      db.insert(claims).values({ itemId, claimerId: crypto.randomUUID(), snapshot }),
    ).rejects.toThrow();
  });

  it("rejects an invalid price category", async () => {
    const db = await createTestDb();
    const id = crypto.randomUUID();
    await expect(
      db.execute(
        sql`INSERT INTO items (owner_id, added_by_id, title, price) VALUES (${id}, ${id}, 'x', '$$$$')`,
      ),
    ).rejects.toThrow();
    await db.insert(items).values({ ownerId: id, addedById: id, title: "ok", price: "$$" });
  });
});
