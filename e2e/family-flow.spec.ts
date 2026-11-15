import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const OWNER = "Olive";
const GIVER = "Bartholomew";
const IDEA = "Secret Telescope";

async function join(page: Page, name: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("Family password").fill("snowman26"); // case-insensitive
  await page.getByRole("button", { name: "Come on in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Type your name").fill(name);
  await page.getByRole("button", { name: "Join the family list" }).click();
  await expect(page).toHaveURL(/\/my-list$/);
}

async function addWish(page: Page, title: string, notes = "", price?: "$" | "$$" | "$$$") {
  const addButton = page.getByRole("button", { name: /Add (a|another) wish/ });
  if (await addButton.isVisible()) await addButton.click();
  await page.getByLabel(/What do you wish for/).fill(title);
  if (notes) await page.getByLabel(/^Notes/).fill(notes);
  if (price) await page.locator(`label:has(input[name="price"][value="${price}"])`).click();
  await page.getByRole("button", { name: "Add to my list" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

/** Records the body of every same-origin response (HTML documents + RSC payloads + action results). */
function recordResponses(context: BrowserContext) {
  const bodies: { url: string; body: string }[] = [];
  context.on("response", async (res) => {
    if (!res.url().startsWith("http://localhost")) return;
    const type = res.headers()["content-type"] ?? "";
    if (!/html|text\/x-component|json|text\/plain/.test(type)) return;
    try {
      bodies.push({ url: res.url(), body: await res.text() });
    } catch {
      /* redirects have no body */
    }
  });
  return bodies;
}

test("wrong family password is rejected", async ({ page }) => {
  await page.goto("/my-list");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("Family password").fill("reindeer");
  await page.getByRole("button", { name: "Come on in" }).click();
  await expect(page.getByText(/not the family password/)).toBeVisible();
  // the name list stays hidden without the passcode
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/welcome$/);
});

test("full family flow keeps every claim secret from the list owner", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const giverCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const giver = await giverCtx.newPage();

  // --- Owner builds a list
  await join(owner, OWNER);
  await addWish(owner, "Wool Scarf", "navy, size M", "$$");
  await addWish(owner, "Cookbook", "", "$");
  await addWish(owner, "Record Player", "", "$$$");
  await owner.getByRole("button", { name: "Move to top" }).last().click(); // Record Player -> #1
  await expect(owner.getByRole("listitem").filter({ hasText: "Record Player" }).getByLabel("Number 1")).toBeVisible();

  // --- Giver claims an item and adds a secret idea
  await join(giver, GIVER);
  await giver.getByRole("link", { name: "Family Lists" }).click();
  await giver.getByRole("link", { name: new RegExp(OWNER) }).click();
  await expect(giver.getByRole("heading", { name: `${OWNER}'s List` })).toBeVisible();
  const ownerId = giver.url().split("/").pop()!;

  const scarf = giver.getByRole("listitem").filter({ hasText: "Wool Scarf" });
  await scarf.getByRole("button", { name: "Mark as gotten" }).click();
  await expect(scarf).toContainText("You're getting this");

  await giver.getByRole("button", { name: "Add a secret idea" }).click();
  await giver.getByLabel(/Gift idea/).fill(IDEA);
  await giver.getByRole("button", { name: "Add secret idea" }).click();
  await expect(giver.getByRole("heading", { name: IDEA })).toBeVisible();

  // filters: only $$ shows the scarf
  await giver.getByRole("button", { name: "$$", exact: true }).click();
  await expect(giver.getByRole("heading", { name: "Wool Scarf" })).toBeVisible();
  await expect(giver.getByRole("heading", { name: "Cookbook" })).toHaveCount(0);

  // --- Owner browses their side of the site; record everything the server sends them
  const ownerBodies = recordResponses(ownerCtx);
  await owner.goto("/my-list");
  await owner.getByRole("link", { name: "My Gifts" }).click(); // client-side nav -> RSC payload
  await expect(owner.getByRole("heading", { name: "My Gifts" })).toBeVisible();
  await owner.getByRole("link", { name: "My List" }).click();
  await expect(owner.getByRole("heading", { name: "My Christmas List" })).toBeVisible();

  // owner edits and deletes items, including the claimed one
  const ownerScarf = owner.getByRole("listitem").filter({ hasText: "Wool Scarf" });
  await ownerScarf.getByRole("button", { name: "Edit" }).click();
  await owner.getByLabel(/^Notes/).fill("red, size M");
  await owner.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("red, size M")).toBeVisible();
  const cookbook = owner.getByRole("listitem").filter({ hasText: "Cookbook" });
  await cookbook.getByRole("button", { name: "Remove" }).click();
  await cookbook.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(owner.getByRole("heading", { name: "Cookbook" })).toHaveCount(0);

  // trying to open their own list from the giver side bounces them back
  await owner.goto(`/family/${ownerId}`);
  await expect(owner).toHaveURL(/\/my-list$/);
  await owner.goto(`/family/${ownerId.toUpperCase()}`); // Postgres matches uuids case-insensitively
  await expect(owner).toHaveURL(/\/my-list$/);
  await owner.goto("/");
  await owner.waitForLoadState("networkidle");

  const leakWords = [GIVER, IDEA, "Telescope", "Gotten by", "getting this", "claimer", "claimed"];
  const ownerOnlyPages = ownerBodies.filter((b) => !/\/family(\?|$)/.test(new URL(b.url).pathname));
  expect(ownerOnlyPages.length).toBeGreaterThan(4);
  for (const { url, body } of ownerOnlyPages) {
    for (const word of leakWords) {
      expect(body, `owner response ${url} leaked "${word}"`).not.toContain(word);
    }
  }

  // The family overview may name the giver as a relative, but nothing about claims or ideas
  await owner.goto("/family");
  const familyHtml = await owner.content();
  for (const word of [IDEA, "Gotten by", "claimed"]) expect(familyHtml).not.toContain(word);

  // --- Giver is told what the owner changed
  await giver.getByRole("link", { name: "My Gifts" }).click();
  const giftCard = giver.getByRole("listitem").filter({ hasText: "Wool Scarf" });
  await expect(giftCard).toContainText("Updated since you marked it");
  await expect(giftCard).toContainText("red, size M");
  await giftCard.getByRole("button", { name: "Got it" }).click();
  await expect(giftCard).not.toContainText("Updated since you marked it");

  await ownerCtx.close();
  await giverCtx.close();
});

test("removing a claimed wish notifies the gift-giver", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const giverCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const giver = await giverCtx.newPage();

  await join(owner, "Penny");
  await addWish(owner, "Snow Boots");
  await join(giver, "Uncle Ray");
  await giver.goto("/family");
  await giver.getByRole("link", { name: /Penny/ }).click();
  await giver.getByRole("button", { name: "Mark as gotten" }).click();
  await expect(giver.getByText("You're getting this")).toBeVisible();

  await owner.reload();
  await owner.getByRole("button", { name: "Remove" }).click();
  await owner.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(owner.getByText(/Your list is empty/)).toBeVisible();

  await giver.goto("/my-gifts");
  await expect(giver.getByRole("status")).toContainText("Penny removed this from their list");
  await giver.getByRole("button", { name: "OK, remove from my gifts" }).click();
  await expect(giver.getByText("You haven't marked any gifts yet.")).toBeVisible();

  // returning users sign in by tapping their name
  await giver.getByRole("button", { name: /Not you\? Switch/ }).click();
  await expect(giver).toHaveURL(/\/sign-in$/);
  await giver.getByRole("button", { name: "Penny" }).click();
  await expect(giver.getByText("Hi,")).toContainText("Penny");

  await ownerCtx.close();
  await giverCtx.close();
});
