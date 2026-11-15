/**
 * PIN sign-in: tapping a name is no longer enough to become that person.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./helpers/db";
import type { DB } from "@/server/db-types";
import { createUser } from "@/server/users";
import {
  adminListPeople,
  adminResetPin,
  getSignInTarget,
  joinWithPin,
  sessionUser,
  setFirstPin,
  signInWithPin,
} from "@/server/auth";
import { hashPin, isValidPin, verifyPin } from "@/server/pin";

describe("pin hashing", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("0420")).toBe(true);
    for (const bad of ["123", "12345", "12a4", " 1234", ""]) expect(isValidPin(bad)).toBe(false);
  });

  it("hashes with a random salt and verifies", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1234");
    expect(await verifyPin("1234", a)).toBe(true);
    expect(await verifyPin("4321", a)).toBe(false);
    expect(await verifyPin("1234", "garbage")).toBe(false);
  });
});

describe("signing in with a PIN", () => {
  let db: DB;
  let momId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const r = await joinWithPin(db, "redder", "Mom", "1111", "1111");
    if (!r.ok) throw new Error("setup");
    momId = r.user.id;
  });

  it("joining requires a matching 4-digit PIN", async () => {
    expect((await joinWithPin(db, "redder", "Zach", "12", "12")).ok).toBe(false);
    expect((await joinWithPin(db, "redder", "Zach", "1234", "4321")).ok).toBe(false);
    const ok = await joinWithPin(db, "redder", "Zach", "1234", "1234");
    expect(ok.ok).toBe(true);
  });

  it("joining with a taken name points to the existing person instead of creating one", async () => {
    const r = await joinWithPin(db, "redder", "mom", "2222", "2222");
    expect(r).toMatchObject({ ok: false, taken: { id: momId, name: "Mom" } });
  });

  it("the right PIN signs you in; the wrong one doesn't", async () => {
    expect(await signInWithPin(db, "redder", momId, "9999")).toMatchObject({ ok: false });
    const ok = await signInWithPin(db, "redder", momId, "1111");
    expect(ok).toMatchObject({ ok: true, user: { id: momId, name: "Mom" } });
  });

  it("locks the name after 5 wrong tries, even with the right PIN", async () => {
    for (let i = 0; i < 4; i++) {
      expect((await signInWithPin(db, "redder", momId, "0000")).ok).toBe(false);
    }
    const fifth = await signInWithPin(db, "redder", momId, "0000");
    expect(fifth).toMatchObject({ ok: false, message: expect.stringMatching(/Too many wrong tries/) });
    expect(await signInWithPin(db, "redder", momId, "1111")).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Too many wrong tries/),
    });
  });

  it("the lock wears off after 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let i = 0; i < 5; i++) await signInWithPin(db, "redder", momId, "0000");
      vi.setSystemTime(Date.now() + 16 * 60_000);
      expect((await signInWithPin(db, "redder", momId, "1111")).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a correct PIN clears earlier wrong tries", async () => {
    for (let i = 0; i < 4; i++) await signInWithPin(db, "redder", momId, "0000");
    expect((await signInWithPin(db, "redder", momId, "1111")).ok).toBe(true);
    for (let i = 0; i < 4; i++) await signInWithPin(db, "redder", momId, "0000");
    expect((await signInWithPin(db, "redder", momId, "1111")).ok).toBe(true);
  });

  it("people from another family can't be signed in as", async () => {
    expect((await signInWithPin(db, "palmbos", momId, "1111")).ok).toBe(false);
    expect(await getSignInTarget(db, "palmbos", momId)).toBeNull();
  });

  it("a session is only valid while the PIN it was made with is unchanged", async () => {
    const r = await signInWithPin(db, "redder", momId, "1111");
    if (!r.ok) throw new Error("setup");
    expect(await sessionUser(db, "redder", momId, r.stamp)).toEqual({ id: momId, name: "Mom" });
    expect(await sessionUser(db, "redder", momId, "not-the-stamp")).toBeNull();
    expect(await sessionUser(db, "redder", momId, undefined)).toBeNull(); // sessions from before PINs
    expect(await sessionUser(db, "palmbos", momId, r.stamp)).toBeNull();

    await adminResetPin(db, momId);
    expect(await sessionUser(db, "redder", momId, r.stamp)).toBeNull();
  });
});

describe("people who joined before PINs existed", () => {
  let db: DB;
  let oldId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const r = await createUser(db, "redder", "Grandpa");
    if (!r.ok) throw new Error("setup");
    oldId = r.user.id;
  });

  it("are asked to set a PIN, which then signs them in", async () => {
    expect(await getSignInTarget(db, "redder", oldId)).toEqual({ user: { id: oldId, name: "Grandpa" }, hasPin: false });
    expect((await signInWithPin(db, "redder", oldId, "1234")).ok).toBe(false);
    expect((await setFirstPin(db, "redder", oldId, "1234", "9999")).ok).toBe(false);
    expect((await setFirstPin(db, "redder", oldId, "1234", "1234")).ok).toBe(true);
    expect(await getSignInTarget(db, "redder", oldId)).toMatchObject({ hasPin: true });
  });

  it("once a PIN is set nobody can overwrite it through first-time setup", async () => {
    await setFirstPin(db, "redder", oldId, "1234", "1234");
    expect((await setFirstPin(db, "redder", oldId, "5555", "5555")).ok).toBe(false);
    expect((await signInWithPin(db, "redder", oldId, "1234")).ok).toBe(true);
  });
});

describe("admin", () => {
  it("lists people across families with PIN status only, and resets a PIN", async () => {
    const db = await createTestDb();
    const mom = await joinWithPin(db, "redder", "Mom", "1111", "1111");
    await createUser(db, "palmbos", "Ellie");
    if (!mom.ok) throw new Error("setup");
    for (let i = 0; i < 5; i++) await signInWithPin(db, "redder", mom.user.id, "0000");

    const people = await adminListPeople(db);
    expect(people).toEqual([
      { id: mom.user.id, name: "Mom", family: "redder", hasPin: true, locked: true },
      { id: expect.any(String), name: "Ellie", family: "palmbos", hasPin: false, locked: false },
    ]);
    expect(Object.keys(people[0]).sort()).toEqual(["family", "hasPin", "id", "locked", "name"]);

    await adminResetPin(db, mom.user.id);
    expect(await getSignInTarget(db, "redder", mom.user.id)).toMatchObject({ hasPin: false });
    expect((await adminListPeople(db))[0]).toMatchObject({ hasPin: false, locked: false });
  });
});
