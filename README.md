# Redder Christmas 2026

A private family Christmas list site. Everyone keeps a wish list; everyone else can browse it and
mark items "gotten", and **the list owner never finds out** what was gotten, by whom, or when.

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Neon Postgres + Drizzle · hosted on Vercel.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000, family password: snowman
```

No database setup is needed locally: without `DATABASE_URL` the app uses an on-disk PGlite
database in `.pglite/` that migrates itself on startup. Delete that folder to start fresh.

## Tests

```bash
npm test             # unit + integration tests (in-memory Postgres), including the secrecy suite
npm run build && npm run e2e   # Playwright: real production build, two browsers (owner + gift-giver)
```

The secrecy rule is checked in three places:
- `tests/secrecy.test.ts`: every owner-facing query/action result is searched for claim data,
  claimer names and secret ideas; claimed vs. unclaimed items must look identical to the owner.
- A static test that `src/server/owner.ts` (the only data the owner's pages read) never touches the claims table.
- `e2e/family-flow.spec.ts`: records every HTML page, RSC payload and action response the owner
  receives while browsing and editing, and checks none of it leaks the claim or the secret idea.

## How secrecy works

| Layer | Where |
| --- | --- |
| Owner pages use a separate, claim-free query module returning only `OwnerItem` fields | `src/server/owner.ts` |
| Givers can't open their own list (`/family/<me>` redirects to My List) | `src/server/giver.ts`, `src/app/(app)/family/[userId]/page.tsx` |
| Owner edits/deletes return the same response whether or not an item was claimed; deletes are soft | `src/server/owner.ts` |
| Identity always comes from a signed cookie; every server action re-checks it | `src/server/session.ts`, `src/server/actions.ts` |

**Known, accepted limitation (honor system):** login is name-only, so someone *could* sign in as
another relative and peek. Optional PINs could be added later without changing the data.

## Deploy to Vercel

1. `npm i -g vercel` then `vercel login`.
2. Push this repo to GitHub and **Import** it at vercel.com/new (framework: Next.js, auto-detected).
3. In the Vercel project: **Storage → Create / Marketplace → Neon** → create a free database and
   connect it to the project. This sets `DATABASE_URL` automatically.
4. **Settings → Environment Variables**, add for Production (and Preview):
   - `FAMILY_PASSCODE`: the family password (case-insensitive)
   - `SESSION_SECRET`: a random string of 32+ characters, e.g. `openssl rand -base64 32`
5. Redeploy. `npm run build` runs `scripts/migrate.ts` first, which creates/updates the tables.
6. Send the family the URL and the password.

Changing `FAMILY_PASSCODE` signs every device out of the family gate (people keep their lists).
For local dev against Neon: `vercel link` then `vercel env pull .env.local`.
