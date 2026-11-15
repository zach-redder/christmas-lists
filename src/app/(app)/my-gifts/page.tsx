import Link from "next/link";
import { RibbonDivider, WaxSeal } from "@/components/decorations";
import { ItemLink, ItemNotes, PriceStamp } from "@/components/ItemDetails";
import { SubmitButton } from "@/components/ui";
import { acknowledgeChangeAction, dismissRemovedAction, unclaimAction } from "@/server/actions";
import { getDb } from "@/server/db";
import { getMyGifts, type Change, type MyGift } from "@/server/gifts";
import { requireUser } from "@/server/session";

export const metadata = { title: "My Gifts" };

const FIELD_LABEL: Record<Change["field"], string> = { title: "Name", url: "Link", notes: "Notes", price: "Price" };

export default async function MyGiftsPage() {
  const me = await requireUser();
  const groups = await getMyGifts(await getDb(), me.id);
  const total = groups.reduce((n, g) => n + g.gifts.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="font-script text-2xl text-pine">Santa&apos;s helper checklist</p>
        <h1 className="text-4xl font-bold">My Gifts</h1>
        <p className="mt-2 text-ink-soft">
          Everything you&apos;ve marked as gotten. The people on this page can&apos;t see it.
        </p>
      </div>
      <RibbonDivider />

      {total === 0 ? (
        <div className="py-6 text-center">
          <p className="font-script text-2xl text-ink-soft">You haven&apos;t marked any gifts yet.</p>
          <Link href="/family" className="mt-3 inline-flex min-h-12 items-center font-semibold text-pine underline underline-offset-4">
            Browse the family lists
          </Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.person.id} aria-labelledby={`for-${group.person.id}`} className="space-y-3">
            <h2 id={`for-${group.person.id}`} className="flex items-baseline gap-2">
              <span className="font-display text-lg text-ink-soft">For</span>
              <Link href={`/family/${group.person.id}`} className="font-script text-4xl text-cranberry hover:underline">
                {group.person.name}
              </Link>
            </h2>
            <ul className="space-y-4">
              {group.gifts.map((gift) => (
                <GiftCard key={gift.itemId} gift={gift} personName={group.person.name} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function GiftCard({ gift, personName }: { gift: MyGift; personName: string }) {
  const hidden = <input type="hidden" name="itemId" value={gift.itemId} />;
  return (
    <li className="gift-tag">
      {gift.status === "removed" && (
        <div role="status" className="mb-3 rounded-lg border-l-4 border-cranberry bg-cranberry/10 px-3 py-2 text-berry-deep">
          <strong>{personName}</strong> removed this from their list. You&apos;d marked it as gotten, so you might want to
          change plans.
        </div>
      )}
      {gift.status === "changed" && (
        <div role="status" className="mb-3 rounded-lg border-l-4 border-gold bg-gold/15 px-3 py-2">
          <strong>Updated since you marked it:</strong>
          <ul className="mt-1 list-disc pl-5">
            {gift.changes.map((c) => (
              <li key={c.field}>
                {FIELD_LABEL[c.field]}: <s className="text-ink-soft">{c.before || "(none)"}</s> → {c.after || "(none)"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-3">
        <WaxSeal className="h-10 w-10 shrink-0 drop-shadow" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={`text-xl font-bold break-words ${gift.status === "removed" ? "line-through" : ""}`}>
              {gift.title}
            </h3>
            <PriceStamp price={gift.price} />
          </div>
          {gift.isIdea && <p className="font-script text-xl text-pine">A secret idea</p>}
          <ItemNotes notes={gift.notes} />
          <ItemLink url={gift.url} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-dashed border-parchment pt-3">
        {gift.status === "removed" ? (
          <form action={dismissRemovedAction}>
            {hidden}
            <SubmitButton variant="ghost">OK, remove from my gifts</SubmitButton>
          </form>
        ) : (
          <>
            {gift.status === "changed" && (
              <form action={acknowledgeChangeAction}>
                {hidden}
                <SubmitButton>Got it</SubmitButton>
              </form>
            )}
            <form action={unclaimAction}>
              {hidden}
              <SubmitButton variant="quiet" pendingText="Undoing…">
                I&apos;m not getting this anymore
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </li>
  );
}
