import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import type { DB } from "@/server/db-types";
import { normalizeName } from "@/server/names";
import { createUser, getUserById, listUsers } from "@/server/users";
import { addMyItem, deleteMyItem, getMyItems, moveMyItem, updateMyItem } from "@/server/owner";
import {
  addIdea,
  claimItem,
  deleteIdea,
  getListForGiver,
  listFamily,
  OwnListError,
  unclaimItem,
  updateIdea,
} from "@/server/giver";
import { acknowledgeChange, dismissRemoved, getMyGifts } from "@/server/gifts";

async function user(db: DB, name: string) {
  const r = await createUser(db, "redder", name);
  if (!r.ok) throw new Error("setup failed");
  return r.user;
}

describe("normalizeName", () => {
  it("trims, collapses spaces, and lower-cases the key", () => {
    expect(normalizeName("  Aunt   Sue ")).toEqual({ ok: true, name: "Aunt Sue", nameKey: "aunt sue" });
  });
  it("rejects empty and overly long names", () => {
    expect(normalizeName("   ").ok).toBe(false);
    expect(normalizeName("x".repeat(41)).ok).toBe(false);
  });
});

describe("users", () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("creates a new user and lists users alphabetically", async () => {
    await user(db, "Zach");
    await user(db, "anna");
    expect((await listUsers(db, "redder")).map((u) => u.name)).toEqual(["anna", "Zach"]);
  });

  it("reports a taken name case-insensitively, returning the existing person", async () => {
    const mom = await user(db, "Mom");
    const r = await createUser(db, "redder", " mom ");
    expect(r).toEqual({ ok: false, reason: "taken", user: { id: mom.id, name: "Mom" } });
  });

  it("getUserById returns null for unknown ids", async () => {
    expect(await getUserById(db, "redder", crypto.randomUUID())).toBeNull();
  });
});

describe("owner list", () => {
  let db: DB;
  let me: string;
  beforeEach(async () => {
    db = await createTestDb();
    me = (await user(db, "Zach")).id;
  });

  it("adds items to the bottom in priority order", async () => {
    await addMyItem(db, me, { title: "Scarf", url: "", notes: "navy", price: "$$" });
    await addMyItem(db, me, { title: "Book", url: "example.com/book", notes: "", price: "" });
    const list = await getMyItems(db, me);
    expect(list.map((i) => i.title)).toEqual(["Scarf", "Book"]);
    expect(list[1]).toMatchObject({ url: "https://example.com/book", notes: null, price: null });
  });

  it("rejects a missing title and bad links", async () => {
    expect((await addMyItem(db, me, { title: "  ", url: "", notes: "", price: "" })).ok).toBe(false);
    expect((await addMyItem(db, me, { title: "x", url: "javascript:alert(1)", notes: "", price: "" })).ok).toBe(false);
  });

  it("edits, reorders, and deletes only my own items", async () => {
    for (const title of ["A", "B", "C"]) await addMyItem(db, me, { title, url: "", notes: "", price: "" });
    const [a, b, c] = await getMyItems(db, me);

    await moveMyItem(db, me, c.id, "top");
    expect((await getMyItems(db, me)).map((i) => i.title)).toEqual(["C", "A", "B"]);
    await moveMyItem(db, me, c.id, "down");
    expect((await getMyItems(db, me)).map((i) => i.title)).toEqual(["A", "C", "B"]);
    await moveMyItem(db, me, a.id, "up"); // already top: no-op
    expect((await getMyItems(db, me)).map((i) => i.title)).toEqual(["A", "C", "B"]);

    await updateMyItem(db, me, b.id, { title: "B2", url: "", notes: "", price: "$$$" });
    await deleteMyItem(db, me, a.id);
    expect((await getMyItems(db, me)).map((i) => [i.title, i.price])).toEqual([
      ["C", null],
      ["B2", "$$$"],
    ]);

    const other = (await user(db, "Mom")).id;
    expect((await updateMyItem(db, other, c.id, { title: "hacked", url: "", notes: "", price: "" })).ok).toBe(false);
    expect((await deleteMyItem(db, other, c.id)).ok).toBe(false);
    expect((await getMyItems(db, me)).map((i) => i.title)).toEqual(["C", "B2"]);
  });
});

describe("gift-giver view & claims", () => {
  let db: DB;
  let zach: string;
  let mom: string;
  let sue: string;
  beforeEach(async () => {
    db = await createTestDb();
    zach = (await user(db, "Zach")).id;
    mom = (await user(db, "Mom")).id;
    sue = (await user(db, "Aunt Sue")).id;
    await addMyItem(db, zach, { title: "Scarf", url: "", notes: "", price: "$$" });
    await addMyItem(db, zach, { title: "Book", url: "", notes: "", price: "$" });
  });

  it("lists everyone except me, with counts of their own wishes", async () => {
    await addIdea(db, "redder", mom, zach, { title: "Grill", url: "", notes: "", price: "$$$" });
    expect(await listFamily(db, "redder", mom)).toEqual([
      { id: sue, name: "Aunt Sue", itemCount: 0 },
      { id: zach, name: "Zach", itemCount: 2 },
    ]);
  });

  it("refuses to show a person their own list from the giver side", async () => {
    await expect(getListForGiver(db, "redder", zach, zach)).rejects.toBeInstanceOf(OwnListError);
  });

  it("lets a giver claim, shows the claimer to others, and blocks double claims", async () => {
    const [scarf] = (await getListForGiver(db, "redder", mom, zach))!.wishes;
    expect(await claimItem(db, "redder", mom, scarf.id)).toEqual({ ok: true });
    expect(await claimItem(db, "redder", sue, scarf.id)).toEqual({ ok: false, message: "Already gotten by Mom." });

    const sueView = (await getListForGiver(db, "redder", sue, zach))!;
    expect(sueView.wishes[0].claim).toEqual({ claimerName: "Mom", isMine: false });
    const momView = (await getListForGiver(db, "redder", mom, zach))!;
    expect(momView.wishes[0].claim).toEqual({ claimerName: "Mom", isMine: true });
  });

  it("only the claimer can un-claim", async () => {
    const [scarf] = (await getListForGiver(db, "redder", mom, zach))!.wishes;
    await claimItem(db, "redder", mom, scarf.id);
    await unclaimItem(db, sue, scarf.id);
    expect((await getListForGiver(db, "redder", sue, zach))!.wishes[0].claim).not.toBeNull();
    await unclaimItem(db, mom, scarf.id);
    expect((await getListForGiver(db, "redder", sue, zach))!.wishes[0].claim).toBeNull();
  });

  it("an owner cannot claim their own item", async () => {
    const [scarf] = await getMyItems(db, zach);
    expect((await claimItem(db, "redder", zach, scarf.id)).ok).toBe(false);
  });

  it("secret ideas: visible to givers, editable only by their creator, not addable to own list", async () => {
    await addIdea(db, "redder", mom, zach, { title: "Grill", url: "", notes: "he mentioned it", price: "$$$" });
    const view = (await getListForGiver(db, "redder", sue, zach))!;
    expect(view.ideas).toHaveLength(1);
    expect(view.ideas[0]).toMatchObject({ title: "Grill", addedByName: "Mom", canEdit: false });
    expect((await getListForGiver(db, "redder", mom, zach))!.ideas[0].canEdit).toBe(true);

    const ideaId = view.ideas[0].id;
    expect((await updateIdea(db, sue, ideaId, { title: "x", url: "", notes: "", price: "" })).ok).toBe(false);
    expect((await updateIdea(db, mom, ideaId, { title: "Big grill", url: "", notes: "", price: "$$$" })).ok).toBe(true);
    expect((await deleteIdea(db, sue, ideaId)).ok).toBe(false);
    expect((await addIdea(db, "redder", zach, zach, { title: "self", url: "", notes: "", price: "" })).ok).toBe(false);

    expect(await claimItem(db, "redder", sue, ideaId)).toEqual({ ok: true });
    expect((await deleteIdea(db, mom, ideaId)).ok).toBe(true);
    expect((await getListForGiver(db, "redder", sue, zach))!.ideas).toHaveLength(0);
  });
});

describe("My Gifts notices", () => {
  let db: DB;
  let zach: string;
  let mom: string;
  beforeEach(async () => {
    db = await createTestDb();
    zach = (await user(db, "Zach")).id;
    mom = (await user(db, "Mom")).id;
    await addMyItem(db, zach, { title: "Scarf", url: "", notes: "navy", price: "$$" });
  });

  it("groups claimed gifts by person", async () => {
    const [scarf] = await getMyItems(db, zach);
    await claimItem(db, "redder", mom, scarf.id);
    const gifts = await getMyGifts(db, mom);
    expect(gifts).toHaveLength(1);
    expect(gifts[0].person).toEqual({ id: zach, name: "Zach" });
    expect(gifts[0].gifts[0]).toMatchObject({ title: "Scarf", status: "ok", changes: [] });
  });

  it("flags owner edits after claiming, and clears them on acknowledge", async () => {
    const [scarf] = await getMyItems(db, zach);
    await claimItem(db, "redder", mom, scarf.id);
    await updateMyItem(db, zach, scarf.id, { title: "Scarf", url: "", notes: "red please", price: "$$" });

    let gift = (await getMyGifts(db, mom))[0].gifts[0];
    expect(gift.status).toBe("changed");
    expect(gift.changes).toEqual([{ field: "notes", before: "navy", after: "red please" }]);

    await acknowledgeChange(db, mom, scarf.id);
    gift = (await getMyGifts(db, mom))[0].gifts[0];
    expect(gift.status).toBe("ok");
  });

  it("flags owner deletes after claiming, and hides them on dismiss", async () => {
    const [scarf] = await getMyItems(db, zach);
    await claimItem(db, "redder", mom, scarf.id);
    await deleteMyItem(db, zach, scarf.id);

    expect((await getMyGifts(db, mom))[0].gifts[0].status).toBe("removed");
    await dismissRemoved(db, mom, scarf.id);
    expect(await getMyGifts(db, mom)).toEqual([]);
  });
});
