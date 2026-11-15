/**
 * Two families share the site and database but must never see or touch each other.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import type { DB } from "@/server/db-types";
import { createUser, getUserById, listUsers } from "@/server/users";
import { addMyItem, getMyItems } from "@/server/owner";
import { addIdea, claimItem, getListForGiver, listFamily } from "@/server/giver";
import { getMyGifts } from "@/server/gifts";

async function user(db: DB, family: "redder" | "palmbos", name: string) {
  const r = await createUser(db, family, name);
  if (!r.ok) throw new Error("setup failed");
  return r.user;
}

describe("families are separate", () => {
  let db: DB;
  let redMom: string;
  let redKid: string;
  let palmMom: string;
  let palmKid: string;
  let palmWish: string;

  beforeEach(async () => {
    db = await createTestDb();
    redMom = (await user(db, "redder", "Mom")).id;
    redKid = (await user(db, "redder", "Zach")).id;
    palmMom = (await user(db, "palmbos", "Mom")).id; // same name, different family: allowed
    palmKid = (await user(db, "palmbos", "Ellie")).id;
    await addMyItem(db, palmMom, { title: "Palmbos Sweater", url: "", notes: "", price: "$" });
    [palmWish] = (await getMyItems(db, palmMom)).map((i) => i.id);
  });

  it("lets each family have its own people with the same names", async () => {
    expect(redMom).not.toBe(palmMom);
    expect((await listUsers(db, "redder")).map((u) => u.name)).toEqual(["Mom", "Zach"]);
    expect((await listUsers(db, "palmbos")).map((u) => u.name)).toEqual(["Ellie", "Mom"]);
  });

  it("a taken name is only taken within the family", async () => {
    const r = await createUser(db, "palmbos", "zach");
    expect(r.ok).toBe(true);
    const again = await createUser(db, "redder", "ZACH");
    expect(again).toMatchObject({ ok: false, reason: "taken", user: { id: redKid } });
  });

  it("the Family page only shows your own family", async () => {
    expect((await listFamily(db, "redder", redKid)).map((p) => p.id)).toEqual([redMom]);
    expect((await listFamily(db, "palmbos", palmKid)).map((p) => p.id)).toEqual([palmMom]);
  });

  it("people from another family look like they don't exist", async () => {
    expect(await getUserById(db, "redder", palmMom)).toBeNull();
    expect(await getListForGiver(db, "redder", redKid, palmMom)).toBeNull();
    expect((await getListForGiver(db, "palmbos", palmKid, palmMom))?.wishes.map((w) => w.title)).toEqual([
      "Palmbos Sweater",
    ]);
  });

  it("can't mark gotten or add ideas across families", async () => {
    expect((await claimItem(db, "redder", redKid, palmWish)).ok).toBe(false);
    expect(await getMyGifts(db, redKid)).toEqual([]);
    expect((await addIdea(db, "redder", redKid, palmMom, { title: "Sneaky", url: "", notes: "", price: "" })).ok).toBe(
      false,
    );
    const list = await getListForGiver(db, "palmbos", palmKid, palmMom);
    expect(list?.ideas).toEqual([]);
    expect(list?.wishes[0].claim).toBeNull();
  });

  it("within a family everything still works", async () => {
    expect(await claimItem(db, "palmbos", palmKid, palmWish)).toEqual({ ok: true });
  });
});
