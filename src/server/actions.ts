"use server";

/**
 * Every Server Action is reachable by a direct POST, so each one re-derives the signed-in
 * person from the signed cookie (requireUser) and never trusts a user id from the form.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { acknowledgeChange, dismissRemoved } from "./gifts";
import { addIdea, claimItem, deleteIdea, unclaimItem, updateIdea } from "./giver";
import { addMyItem, deleteMyItem, moveMyItem, updateMyItem, type Move } from "./owner";
import type { Result } from "./result";
import { currentFamily, endSession, grantFamilyAccess, leaveFamily, requireUser, startSession } from "./session";
import { familyForPasscode } from "./tokens";
import { createUser, getUserById, touchUser, type PublicUser } from "./users";
import { itemInputFromForm } from "./validation";

export type FormState = { ok?: boolean; error?: string; nonce?: number };

const field = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

function toState(result: Result): FormState {
  return result.ok ? { ok: true, nonce: Date.now() } : { error: result.message, nonce: Date.now() };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Family gate & sign-in ----------

export async function enterPasscodeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const family = familyForPasscode(field(form, "passcode"));
  if (!family) {
    return { error: "That's not the family password. Ask whoever sent you the link!" };
  }
  await grantFamilyAccess(family.id);
  redirect("/sign-in");
}

export async function signInAsAction(form: FormData): Promise<void> {
  const family = await currentFamily();
  if (!family) redirect("/welcome");
  const db = await getDb();
  const user = await getUserById(db, family.id, field(form, "userId"));
  if (!user) redirect("/sign-in");
  await touchUser(db, user.id);
  await startSession(user.id);
  redirect("/");
}

export type JoinState = { error?: string; taken?: PublicUser; nonce?: number };

export async function joinAction(_prev: JoinState, form: FormData): Promise<JoinState> {
  const family = await currentFamily();
  if (!family) redirect("/welcome");
  const result = await createUser(await getDb(), family.id, field(form, "name"));
  if (!result.ok) {
    return result.reason === "taken"
      ? { taken: result.user, nonce: Date.now() }
      : { error: result.message, nonce: Date.now() };
  }
  await startSession(result.user.id);
  redirect("/my-list");
}

export async function switchPersonAction(): Promise<void> {
  await endSession();
  redirect("/sign-in");
}

export async function leaveFamilyAction(): Promise<void> {
  await leaveFamily();
  redirect("/welcome");
}

// ---------- My List (owner) ----------

export async function addMyItemAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const result = await addMyItem(await getDb(), me.id, itemInputFromForm(form));
  if (result.ok) refresh();
  return toState(result);
}

export async function updateMyItemAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const result = await updateMyItem(await getDb(), me.id, field(form, "itemId"), itemInputFromForm(form));
  if (result.ok) refresh();
  return toState(result);
}

export async function deleteMyItemAction(form: FormData): Promise<void> {
  const me = await requireUser();
  await deleteMyItem(await getDb(), me.id, field(form, "itemId"));
  refresh();
}

export async function moveMyItemAction(form: FormData): Promise<void> {
  const me = await requireUser();
  const move = field(form, "move");
  if (move !== "up" && move !== "down" && move !== "top") return;
  await moveMyItem(await getDb(), me.id, field(form, "itemId"), move satisfies Move);
  refresh();
}

// ---------- Family lists (gift-giver) ----------

export async function claimAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const result = await claimItem(await getDb(), me.family.id, me.id, field(form, "itemId"));
  refresh();
  return toState(result);
}

export async function unclaimAction(form: FormData): Promise<void> {
  const me = await requireUser();
  await unclaimItem(await getDb(), me.id, field(form, "itemId"));
  refresh();
}

export async function addIdeaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const result = await addIdea(await getDb(), me.family.id, me.id, field(form, "ownerId"), itemInputFromForm(form));
  if (result.ok) refresh();
  return toState(result);
}

export async function updateIdeaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const result = await updateIdea(await getDb(), me.id, field(form, "itemId"), itemInputFromForm(form));
  if (result.ok) refresh();
  return toState(result);
}

export async function deleteIdeaAction(form: FormData): Promise<void> {
  const me = await requireUser();
  await deleteIdea(await getDb(), me.id, field(form, "itemId"));
  refresh();
}

// ---------- My Gifts ----------

export async function acknowledgeChangeAction(form: FormData): Promise<void> {
  const me = await requireUser();
  await acknowledgeChange(await getDb(), me.id, field(form, "itemId"));
  refresh();
}

export async function dismissRemovedAction(form: FormData): Promise<void> {
  const me = await requireUser();
  await dismissRemoved(await getDb(), me.id, field(form, "itemId"));
  refresh();
}
