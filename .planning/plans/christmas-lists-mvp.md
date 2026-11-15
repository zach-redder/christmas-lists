# Redder Christmas 2026 — Implementation Plan

## Context
A private family website (greenfield, empty repo) where each person keeps a Christmas wish list and everyone else can browse lists and mark items "gotten" — **without the list owner ever learning what was claimed, by whom, or when**. React + Tailwind, hosted on Vercel, small trusted audience, casual name-only login.

### Decisions confirmed with you
| Topic | Decision |
|---|---|
| Stack | **Next.js (App Router, TypeScript) + Tailwind CSS** on Vercel |
| Storage | **Neon Postgres** (free tier, Vercel Marketplace) via **Drizzle ORM** — JSON files can't persist on Vercel (read-only, per-instance filesystem) |
| Family gate | **Shared family passcode** once per device, then type/tap your name |
| Impersonation | **Honor system** (no PINs) — accepted known loophole, documented below |
| Claimed item edited/deleted | **Notify the gift-giver** on their "My Gifts" page; owner never told |
| Secret ideas | **Yes** — givers can add hidden ideas to someone else's list |
| Claim states | **One step: "Gotten"**, shows claimer; only the claimer can un-claim |
| Look | **Vintage holiday card** — cream paper, cranberry & pine, serif + handwritten accents |

### Defaults I chose (tell me if you disagree)
- Names are unique **case-insensitively** ("mom" = "Mom"); display spelling kept as typed first.
- Sign-in screen shows **tappable buttons of existing names** + "I'm new here" field (easiest for less tech-savvy relatives; consistent with honor system).
- Sessions last ~1 year on a device; a visible **"Not you? Switch person"** link everywhere.
- Reordering uses big **↑ / ↓ / "Move to top"** buttons (reliable on phones) rather than drag-and-drop.
- Secret ideas appear in a separate **"Family ideas (hidden from ‹Name›)"** section under the owner's own items.
- One admin role is **not** included (not needed under honor system); data can be fixed via Neon console if ever required.

---

## 1. Architecture
```
Browser (React client components: forms, filters, snow)
   │  only receives role-specific DTOs
   ▼
Next.js on Vercel (Node runtime, Fluid Compute)
   ├─ Server Components (pages render data on server)
   ├─ Server Actions (all mutations)
   ├─ middleware.ts  → requires passcode cookie + session cookie
   └─ src/server/*   → THE ONLY code that touches the DB ("server-only")
   ▼
Neon Postgres (DATABASE_URL injected by Vercel integration)
```
- No public JSON API routes — data flows only through server components and server actions, so there's no endpoint an owner could call to fetch raw rows.
- All pages `dynamic = 'force-dynamic'` (per-user data, never cached/shared across users).
- Libraries: `drizzle-orm` + `drizzle-kit`, `@neondatabase/serverless`, `jose` (signed cookies), `zod` (input validation), `server-only`, `vitest`, `@electric-sql/pglite` (in-memory Postgres for tests), `@playwright/test`.

### Project structure
```
src/
  app/
    welcome/page.tsx          # family passcode gate
    sign-in/page.tsx          # who are you?
    page.tsx                  # home: big buttons
    my-list/page.tsx          # owner view
    family/page.tsx           # everyone else's gift tags
    family/[userId]/page.tsx  # giver view of one person's list
    my-gifts/page.tsx         # what I've claimed + notices
    layout.tsx                # fonts, snow, header, bottom tab bar
  server/
    db.ts  schema.ts  session.ts
    owner-queries.ts          # owner-safe reads (never touch claims)
    giver-queries.ts          # giver reads (include claims)
    actions/{auth,items,claims,ideas}.ts
  components/                 # GiftTag, PriceStamp, RibbonDivider, Snowfall, TabBar, FilterChips…
  middleware.ts
drizzle/                      # migrations
tests/  (unit + integration via PGlite)   e2e/ (Playwright)
```

## 2. Data model (Postgres)
```
users   id uuid pk · name text · name_key text UNIQUE (lower/trimmed) · created_at · last_seen_at
items   id uuid pk · owner_id uuid · added_by_id uuid · title text NOT NULL · url text · notes text
        · price text CHECK in ('$','$$','$$$') NULL · position int · created_at · updated_at · deleted_at
claims  id uuid pk · item_id uuid UNIQUE · claimer_id uuid · claimed_at
        · snapshot jsonb   -- {title,url,notes,price} at claim time (or last acknowledged)
        · dismissed_at     -- giver dismissed a "removed by owner" notice
```
- **Owner item** = `added_by_id = owner_id`. **Secret idea** = `added_by_id ≠ owner_id`.
- `UNIQUE(item_id)` on claims guarantees two people can't claim the same item at once (second gets "Already gotten by Aunt Sue").
- Items are **always soft-deleted** (owner delete behaves identically whether claimed or not).
- Priority = `position` among the owner's own items (secret ideas ordered separately by created_at).

## 3. How secrecy is enforced (the critical part)
**Layer 1 — Separate, structurally-safe queries.** `owner-queries.ts` exposes `getMyItems(sessionUserId)`:
`SELECT id,title,url,notes,price,position,updated_at FROM items WHERE owner_id=$me AND added_by_id=$me AND deleted_at IS NULL` — explicit column list, **never joins `claims`**, returns an `OwnerItem` type that has no claim fields. This file is forbidden (lint rule + test) from importing the `claims` table.

**Layer 2 — Viewer checks everywhere.**
- `family/[userId]` with `userId === me` → redirect to `/my-list`. `giver-queries.getListForGiver(viewer, owner)` throws if `viewer === owner`.
- Family overview never shows counts like "3 of 5 gotten" on any card (and your own card isn't shown).
- Claim action rejects if `item.owner_id === me`. Idea actions reject adding ideas to your own list.

**Layer 3 — Indistinguishable owner mutations.** Edit/delete/reorder return the same shape and messages whether or not an item is claimed — no "can't delete, someone bought this" errors, no differing response. Delete is always a soft delete.

**Layer 4 — No leaky surfaces.** Owner identity always comes from the signed session cookie, never from URL/params. No caching of per-user pages. No claim data in URLs, page titles, or client-side state for owners. Server-rendered HTML + RSC payload for owner pages contain only `OwnerItem` fields.

### Edge cases
| Case | Behavior |
|---|---|
| Owner deletes a claimed item | Disappears for owner & other givers. Claimer's **My Gifts** shows "‹Item› was removed from ‹Name›'s list — you'd marked it gotten" with a **Dismiss** button. |
| Owner edits a claimed item | Claim stays. Claimer sees **"Updated since you claimed it"** with the changed fields (diff vs `snapshot`); "Got it" re-snapshots. |
| Owner reorders | No effect on claims; givers see new priority. |
| Giver un-claims | Only the original claimer can. |
| Secret idea | Visible to everyone except the owner; editable/deletable by its creator; claimable like any item. Never counted or shown in owner's view. |
| Two people claim simultaneously | DB unique constraint → second sees who got it. |
| **Honor-system impersonation** (owner taps "Mom" on sign-in) | **Known, accepted loophole.** Mitigation: none beyond trust. Could add optional PINs later without data changes. |
| Shared device (couple shares a phone/tablet) | Prominent current-user name in header + "Switch person"; I'll note this in a short "how to use" blurb. |
| Same name, different people (two "Mike"s) | Name is unique; second sees "That name's taken — are you Mike? Or add a last initial (Mike R.)". |

## 4. Login / user recognition
1. **/welcome**: enter family passcode (env `FAMILY_PASSCODE`) → signed `family_ok` cookie (httpOnly, Secure, SameSite=Lax, 1 yr).
2. **/sign-in**: tap your name or type a new one → upsert by `name_key` → signed `session` cookie containing `userId` (JWT via `jose`, `SESSION_SECRET`).
3. `middleware.ts` redirects: no `family_ok` → /welcome; no session → /sign-in.
4. "Switch person" clears session cookie only (not the passcode cookie).

## 5. Screens & flows
Mobile-first; a **bottom tab bar** on phones (top nav on desktop): **My List · Family · My Gifts**. Header always shows "Hi, ‹Name›".

- **Home** — three large gift-tag buttons with one-line explanations.
- **My List (owner)** — numbered items (1 = want most). "Add a wish" form: Title*, Link, Notes, Price ($/$$/$$$ toggle). Each item: Edit · Delete (confirm) · ↑ ↓ · Move to top. Empty state: "Your list is empty — what's Santa bringing?" + Add button.
- **Family** — grid of gift tags, one per other person, with item count of *their* list (claims never counted).
- **Person's list (giver)** — filters: price chips ($/$$/$$$), sort (Priority / Price low→high / high→low), toggle "Hide gotten". Each item: link button, notes, price stamp, and either **"Mark as gotten"** or **"Gotten by Aunt Sue ✓"** (+ "Undo" if you). Section "Family ideas (hidden from ‹Name›)" + "Add a secret idea".
- **My Gifts** — everything I've claimed, grouped by person, with removed/updated notices at top. Works as a shopping checklist.

**Owner flow:** passcode → name → My List → add/reorder/edit → done (no indication of claims anywhere).
**Giver flow:** Family → pick person → filter/sort → Mark as gotten → see it in My Gifts → get notices if owner changes things.

## 6. Design direction — "Vintage holiday card"
**Palette (Tailwind theme tokens / CSS variables)**
| Role | Token | Hex |
|---|---|---|
| Primary | `cranberry` | #9E1B32 |
| Primary dark (headings, hover) | `berry-deep` | #6B0F1F |
| Primary bright (accents, stamps) | `holly` | #C4232F |
| Secondary | `pine` | #1F4D3A |
| Secondary light | `fir` | #3C7A5A |
| Soft green (chips, success) | `sage` | #DCE8DC |
| Background "paper" | `cream` | #F8F2E4 |
| Cards / snow | `snow` | #FFFDF8 |
| Ink text | `ink` | #2B1D16 |
| Sparing accent (string, foil) | `gold` | #B8902F |
All text/background pairs checked for ≥4.5:1 contrast.

**Typography** (Google Fonts via `next/font`): **Fraunces** (soft vintage serif) for headings/site name; **Lora** for body at 18px base for easy reading; **Caveat** handwritten for people's names on tags and small "from Santa's workshop" touches.

**Cozy/snow details**
- Subtle paper-grain texture on the cream background (inline SVG noise, tiny).
- Items rendered as **gift tags**: notched corner, punched hole with gold string, slight rotation variety on the Family grid.
- Price shown as a **postage-stamp badge** ($ / $$ / $$$) with perforated edge.
- **Ribbon dividers** (red ribbon + bow SVG) between sections; holly sprig in header; snow-capped header edge.
- **Gentle falling snow** (lightweight canvas, ~60 flakes, pauses when tab hidden), disabled under `prefers-reduced-motion`, with a ❄ on/off toggle remembered in localStorage.
- "Gotten" state: a red wax-seal check mark.
- Usability rules: 48px minimum tap targets, plain-language labels ("Mark as gotten", not icons alone), visible focus rings, one primary button per screen.

## 7. Vercel deployment
1. Install CLI: `npm i -g vercel`; `vercel login`.
2. Push repo to GitHub → **Import** in Vercel (framework auto-detected: Next.js).
3. Vercel dashboard → **Storage / Marketplace → Neon** → create DB, connect to project (sets `DATABASE_URL` for all envs; Neon branches for Preview).
4. Add env vars: `FAMILY_PASSCODE`, `SESSION_SECRET` (random 32+ bytes) — `vercel env add`; `vercel env pull .env.local` for local dev.
5. Migrations: `drizzle-kit migrate` run as part of the build command (`npm run db:migrate && next build`).
6. Deploy (push to `main` = production; branches = preview URLs). Optional: custom domain.
7. Share URL + passcode with family.

## 8. Build order & verification (TDD — tests first for each step)
Workflow: initial scaffold commit on `main`, then work on `feature/christmas-lists-mvp`; plan copy saved to `.planning/plans/` on approval.

1. **Scaffold** — `create-next-app` (TS, Tailwind, App Router), Vitest, Playwright, lint. *Verify:* `npm run build`, empty test passes.
2. **Schema + DB** — Drizzle schema, migration, PGlite test harness. *Verify:* migration applies to PGlite; constraint tests (unique name_key, unique claim per item, price check).
3. **Session + passcode + middleware** — *Verify:* unit tests for cookie sign/verify/tamper rejection; e2e: no passcode → /welcome, wrong passcode rejected, name sign-in creates/reuses user case-insensitively.
4. **My List (owner CRUD + reorder)** — *Verify:* integration tests for add/edit/delete/reorder & validation; e2e on phone viewport.
5. **Family + giver view + claims** — *Verify:* claim/unclaim permissions, double-claim race returns claimer name, can't claim own item, filters/sorting correct.
6. **Secret ideas** — *Verify:* visible to givers, absent from owner.
7. **My Gifts + notices** — *Verify:* delete-after-claim shows removed notice & dismiss works; edit-after-claim shows diff; "Got it" clears.
8. **🔒 Secrecy test suite (gate before deploy)**
   - Integration: seed owner A, giver B ("Bartholomew"), B claims an item and adds a secret idea. For **every** owner-facing query & action result, `JSON.stringify` and assert it contains none of: B's name/id, claim ids, `claimed_at`, secret idea titles.
   - Owner edit/delete of claimed vs. unclaimed item → responses deep-equal.
   - Static test: `owner-queries.ts` does not import `claims`.
   - **Playwright:** log in as A, load /my-list, /family, home; capture full HTML **and all network/RSC responses**; assert the claimer's name, "Gotten", and secret idea titles never appear. Try `/family/<A's id>` → redirected.
9. **Design pass** — tokens, fonts, tag/stamp/ribbon components, snow, empty/loading/error states. *Verify:* screenshots at 375 / 768 / 1440, reduced-motion check, contrast check, Lighthouse accessibility ≥ 95.
10. **Deploy** — steps in §7; *verify* on production URL with two real devices (phone as owner, laptop as giver) repeating the secrecy check manually.
