/**
 * The secrecy rule: a list owner must never be able to learn whether, by whom, or when
 * any of their items were claimed — and must never see secret ideas on their list.
 * These tests check every owner-facing read and write for leaks.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTestDb } from "./helpers/db";
import type { DB } from "@/server/db-types";
import { createUser, getUserById, listUsers } from "@/server/users";
import { addMyItem, deleteMyItem, getMyItems, moveMyItem, updateMyItem } from "@/server/owner";
import { addIdea, claimItem, getListForGiver, listFamily, OwnListError } from "@/server/giver";
import { getMyGifts } from "@/server/gifts";

const CLAIMER = "Bartholomew";
const IDEA = "Secret Telescope";

describe("secrecy rule", () => {
  let db: DB;
  let owner: string;
  let giver: string;
  let claimedId: string;
  let unclaimedId: string;
  let forbidden: string[];

  beforeEach(async () => {
    db = await createTestDb();
    const o = await createUser(db, "redder", "Owner Olive");
    const g = await createUser(db, "redder", CLAIMER);
    if (!o.ok || !g.ok) throw new Error("setup");
    owner = o.user.id;
    giver = g.user.id;

    await addMyItem(db, owner, { title: "Wish One", url: "", notes: "", price: "$$" });
    await addMyItem(db, owner, { title: "Wish Two", url: "", notes: "", price: "$$" });
    [claimedId, unclaimedId] = (await getMyItems(db, owner)).map((i) => i.id);

    expect(await claimItem(db, "redder", giver, claimedId)).toEqual({ ok: true });
    expect((await addIdea(db, "redder", giver, owner, { title: IDEA, url: "", notes: "", price: "$" })).ok).toBe(true);

    forbidden = [CLAIMER, giver, IDEA, "claim", "Claim", "gotten", "Gotten"];
  });

  function assertNoLeak(label: string, value: unknown) {
    const json = JSON.stringify(value) ?? "";
    for (const word of forbidden) {
      expect(json, `${label} leaked "${word}"`).not.toContain(word);
    }
  }

  it("the owner's list contains no claim data and no secret ideas", async () => {
    const list = await getMyItems(db, owner);
    assertNoLeak("getMyItems", list);
    expect(list.map((i) => i.title)).toEqual(["Wish One", "Wish Two"]);
    // exact field whitelist: anything new must be a conscious decision
    expect(Object.keys(list[0]).sort()).toEqual(["id", "notes", "position", "price", "title", "url"]);
    // claimed and unclaimed items are structurally identical
    const shape = (i: (typeof list)[number]) => ({ url: i.url, notes: i.notes, price: i.price });
    expect(shape(list[0])).toEqual(shape(list[1]));
  });

  it("owner mutations respond identically for claimed and unclaimed items", async () => {
    const input = { title: "Edited", url: "", notes: "", price: "$" as const };
    expect(await updateMyItem(db, owner, claimedId, input)).toEqual(
      await updateMyItem(db, owner, unclaimedId, input),
    );
    expect(await moveMyItem(db, owner, claimedId, "down")).toEqual(
      await moveMyItem(db, owner, unclaimedId, "down"),
    );
    const delClaimed = await deleteMyItem(db, owner, claimedId);
    const delUnclaimed = await deleteMyItem(db, owner, unclaimedId);
    expect(delClaimed).toEqual(delUnclaimed);
    for (const r of [delClaimed, delUnclaimed]) assertNoLeak("owner mutation", r);
  });

  it("the family overview and user lists leak nothing to the owner", async () => {
    const family = await listFamily(db, "redder", owner);
    // the giver legitimately appears as a family member, so only check claim/idea words here
    const json = JSON.stringify(family);
    for (const word of [IDEA, "claim", "Claim", "gotten", "Gotten"]) expect(json).not.toContain(word);
    // the giver appears as a family member, but their card says nothing about claims
    expect(Object.keys(family[0]).sort()).toEqual(["id", "itemCount", "name"]);
    expect(family.find((f) => f.id === owner)).toBeUndefined();
    expect(Object.keys((await listUsers(db, "redder"))[0]).sort()).toEqual(["id", "name"]);
    expect(Object.keys((await getUserById(db, "redder", owner))!).sort()).toEqual(["id", "name"]);
  });

  it("the owner's My Gifts page says nothing about their own items", async () => {
    assertNoLeak("getMyGifts(owner)", await getMyGifts(db, owner));
    expect(await getMyGifts(db, owner)).toEqual([]);
  });

  it("the owner cannot open their own list from the giver side", async () => {
    await expect(getListForGiver(db, "redder", owner, owner)).rejects.toBeInstanceOf(OwnListError);
  });

  it("the own-list check can't be bypassed with a differently-cased id", async () => {
    await expect(getListForGiver(db, "redder", owner, owner.toUpperCase())).rejects.toBeInstanceOf(OwnListError);
    const r = await addIdea(db, "redder", owner, owner.toUpperCase(), { title: "self idea", url: "", notes: "", price: "" });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(await getMyItems(db, owner))).not.toContain("self idea");
  });

  it("owner-queries module never references the claims table", () => {
    const src = readFileSync(path.resolve(__dirname, "../src/server/owner.ts"), "utf8");
    expect(src).not.toMatch(/\bclaims\b/);
  });
});
