import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const OWNER = "Olive";
const GIVER = "Bartholomew";
const IDEA = "Secret Telescope";

const PIN = "2468";

async function join(page: Page, name: string, password = "snowman26" /* case-insensitive */, pin = PIN) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("Family password").fill(password);
  await page.getByRole("button", { name: "Come on in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Type your name").fill(name);
  await page.getByLabel("Choose a 4-number PIN").fill(pin);
  await page.getByLabel("Type your PIN again").fill(pin);
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

  // returning users tap their name, then need that person's PIN
  await giver.getByRole("button", { name: /Not you\? Switch/ }).click();
  await expect(giver).toHaveURL(/\/sign-in$/);
  await giver.getByRole("link", { name: "Penny" }).click();
  await giver.getByLabel("Your PIN").fill(PIN);
  await giver.getByRole("button", { name: "Sign in" }).click();
  await expect(giver.getByText("Hi,")).toContainText("Penny");

  await ownerCtx.close();
  await giverCtx.close();
});

test("a second family gets its own separate site behind its own password", async ({ browser }) => {
  const redCtx = await browser.newContext();
  const palmCtx = await browser.newContext();
  const red = await redCtx.newPage();
  const palm = await palmCtx.newPage();

  await join(red, "Grandpa Joe");
  await addWish(red, "Redder Fishing Rod");
  await expect(red.getByRole("link", { name: /Redder Christmas/ })).toBeVisible();

  // Same name is fine in another family
  await join(palm, "Grandpa Joe", "TINSEL");
  await expect(palm.getByRole("link", { name: /Palmbos Christmas/ })).toBeVisible();
  await addWish(palm, "Palmbos Puzzle");

  // Neither family sees the other
  await palm.goto("/family");
  await expect(palm.getByText(/No one else has joined yet/)).toBeVisible();
  await palm.getByRole("button", { name: /Not you\? Switch/ }).click();
  await expect(palm.getByRole("link", { name: "Olive" })).toHaveCount(0);
  await expect(palm.getByRole("link", { name: "Grandpa Joe" })).toHaveCount(1);
  const palmHtml = await palm.content();
  expect(palmHtml).not.toContain("Redder");

  // A Redder person's list is a 404 for the Palmbos family
  await red.goto("/family");
  await expect(red.getByRole("link", { name: /Grandpa Joe/ })).toHaveCount(0);

  // A device can switch to the other family by entering the other password
  await palm.getByRole("button", { name: /Not the Palmbos family/ }).click();
  await expect(palm).toHaveURL(/\/welcome$/);
  await palm.getByLabel("Family password").fill("snowman26");
  await palm.getByRole("button", { name: "Come on in" }).click();
  await expect(palm.getByRole("heading", { name: /Redder Christmas/ })).toBeVisible();

  await redCtx.close();
  await palmCtx.close();
});

test("tapping someone else's name doesn't get you in without their PIN; admin can reset it", async ({ browser }) => {
  const run = Math.random().toString(36).slice(2, 6); // unique names so the test can repeat on one database
  const SUE = `Aunt Sue ${run}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await join(page, SUE, "snowman26", "1357");
  await addWish(page, "Teapot");

  const peeker = await (await browser.newContext()).newPage();
  await join(peeker, `Cousin Vinny ${run}`);
  await peeker.getByRole("button", { name: /Not you\? Switch/ }).click();
  await peeker.getByRole("link", { name: SUE }).click();
  await expect(peeker).toHaveURL(/\/sign-in\?as=/);
  await peeker.waitForLoadState("networkidle"); // typing before the page is interactive gets wiped
  // wait for each answer: the old error message stays on screen while the next try is checked
  const tryPin = async (pin: string) => {
    await peeker.getByLabel("Your PIN").fill(pin);
    await Promise.all([
      peeker.waitForResponse((r) => r.request().method() === "POST"),
      peeker.getByRole("button", { name: "Sign in" }).click(),
    ]);
  };
  for (let i = 0; i < 4; i++) {
    await tryPin("0000");
    await expect(peeker.getByText("That PIN isn't right")).toBeVisible();
  }
  await tryPin("0000");
  await expect(peeker.getByText(/Too many wrong tries/)).toBeVisible();
  await peeker.goto("/my-list");
  await expect(peeker).toHaveURL(/\/sign-in$/);

  // Admin resets Aunt Sue's PIN: she is signed out and picks a new one
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/admin");
  await admin.getByLabel("Admin password").fill("wrong");
  await admin.getByRole("button", { name: "Sign in as admin" }).click();
  await expect(admin.getByText("That's not the admin password.")).toBeVisible();
  await admin.getByLabel("Admin password").fill("Holly-Admin");
  await admin.getByRole("button", { name: "Sign in as admin" }).click();
  await expect(admin.getByText(/locked/)).toBeVisible();
  expect(await admin.content()).not.toContain("Teapot");
  await admin.getByRole("button", { name: `Reset ${SUE}'s PIN` }).click();
  await expect(admin.getByRole("listitem").filter({ hasText: SUE })).toContainText("no PIN yet");

  await page.goto("/my-list");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole("link", { name: SUE }).click();
  await page.getByLabel("Choose your PIN").fill("8642");
  await page.getByLabel("Type it again").fill("8642");
  await page.getByRole("button", { name: "Save PIN and sign in" }).click();
  await expect(page.getByText("Hi,")).toContainText(SUE);
  await page.goto("/my-list");
  await expect(page.getByRole("heading", { name: "Teapot" })).toBeVisible();
  await ctx.close();
});
