"use client";

import { useActionState, useMemo, useState } from "react";
import {
  addIdeaAction,
  claimAction,
  deleteIdeaAction,
  unclaimAction,
  updateIdeaAction,
} from "@/server/actions";
import type { GiverIdea, GiverItem, GiverList } from "@/server/giver";
import type { Price } from "@/server/schema";
import { RibbonDivider, WaxSeal } from "./decorations";
import { ItemForm } from "./ItemForm";
import { ItemLink, ItemNotes, PriceStamp } from "./ItemDetails";
import { buttonStyles, FormError, SubmitButton } from "./ui";

type Sort = "priority" | "price-low" | "price-high";
const PRICE_RANK: Record<Price, number> = { $: 1, $$: 2, $$$: 3 };
const PRICES: Price[] = ["$", "$$", "$$$"];

function applyView<T extends GiverItem>(items: T[], prices: Set<Price>, sort: Sort, hideGotten: boolean): T[] {
  const filtered = items.filter(
    (i) => (prices.size === 0 || (i.price !== null && prices.has(i.price))) && !(hideGotten && i.claim),
  );
  if (sort === "priority") return filtered;
  const dir = sort === "price-low" ? 1 : -1;
  // items without a price always go last
  return [...filtered].sort((a, b) => {
    if (!a.price || !b.price) return (a.price ? 0 : 1) - (b.price ? 0 : 1);
    return (PRICE_RANK[a.price] - PRICE_RANK[b.price]) * dir;
  });
}

export function GiverListView({ list }: { list: GiverList }) {
  const [prices, setPrices] = useState<Set<Price>>(new Set());
  const [sort, setSort] = useState<Sort>("priority");
  const [hideGotten, setHideGotten] = useState(false);
  const [addingIdea, setAddingIdea] = useState(false);

  const wishes = useMemo(() => applyView(list.wishes, prices, sort, hideGotten), [list.wishes, prices, sort, hideGotten]);
  const ideas = useMemo(() => applyView(list.ideas, prices, sort, hideGotten), [list.ideas, prices, sort, hideGotten]);
  const rankOf = useMemo(() => new Map(list.wishes.map((w, i) => [w.id, i + 1])), [list.wishes]);
  const filtering = prices.size > 0 || hideGotten;

  const togglePrice = (p: Price) =>
    setPrices((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <div className="space-y-5">
      {/* Filters */}
      <section aria-label="Sort and filter" className="space-y-3 rounded-xl border border-parchment bg-snow/80 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Price:</span>
          {PRICES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={prices.has(p)}
              onClick={() => togglePrice(p)}
              className={`min-h-11 min-w-14 rounded-full border-2 px-3 font-display font-bold ${
                prices.has(p) ? "border-pine bg-pine text-snow" : "border-parchment bg-snow text-ink hover:border-fir"
              }`}
            >
              {p}
            </button>
          ))}
          {prices.size > 0 && (
            <button type="button" onClick={() => setPrices(new Set())} className={buttonStyles.quiet}>
              Show all
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="font-semibold">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="min-h-11 rounded-lg border-2 border-parchment bg-snow px-2"
            >
              <option value="priority">Most wanted first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideGotten}
              onChange={(e) => setHideGotten(e.target.checked)}
              className="h-5 w-5 accent-pine"
            />
            Hide items already gotten
          </label>
        </div>
      </section>

      {/* Wishes */}
      {list.wishes.length === 0 ? (
        <p className="py-4 text-center font-script text-2xl text-ink-soft">
          {list.owner.name} hasn&apos;t added any wishes yet.
        </p>
      ) : wishes.length === 0 ? (
        <p className="py-4 text-center text-ink-soft">No wishes match these filters.</p>
      ) : (
        <ul className="space-y-4">
          {wishes.map((item) => (
            <GiverItemCard key={item.id} item={item} rank={rankOf.get(item.id)} />
          ))}
        </ul>
      )}

      {/* Secret ideas */}
      <RibbonDivider label={`Secret ideas · hidden from ${list.owner.name}`} className="pt-4" />
      <p className="text-ink-soft">
        Heard {list.owner.name} mention something that isn&apos;t on their list? Add it here. Everyone except{" "}
        {list.owner.name} can see it.
      </p>
      {ideas.length > 0 && (
        <ul className="space-y-4">
          {ideas.map((idea) => (
            <GiverItemCard key={idea.id} item={idea} />
          ))}
        </ul>
      )}
      {list.ideas.length > 0 && ideas.length === 0 && filtering && (
        <p className="text-center text-ink-soft">No ideas match these filters.</p>
      )}
      {addingIdea ? (
        <section className="gift-tag" aria-labelledby="add-idea">
          <h2 id="add-idea" className="mb-3 text-2xl font-bold">
            Add a secret idea for {list.owner.name}
          </h2>
          <ItemForm
            action={addIdeaAction}
            hidden={{ ownerId: list.owner.id }}
            submitLabel="Add secret idea"
            titleLabel="Gift idea"
            onDone={() => setAddingIdea(false)}
            onCancel={() => setAddingIdea(false)}
          />
        </section>
      ) : (
        <button type="button" onClick={() => setAddingIdea(true)} className={buttonStyles.ghost}>
          <span aria-hidden="true">＋</span> Add a secret idea
        </button>
      )}
    </div>
  );
}

function isIdea(item: GiverItem | GiverIdea): item is GiverIdea {
  return "addedByName" in item;
}

function GiverItemCard({ item, rank }: { item: GiverItem | GiverIdea; rank?: number }) {
  const [claimState, claim] = useActionState(claimAction, {});
  const [editing, setEditing] = useState(false);
  const idea = isIdea(item) ? item : null;
  const gotten = item.claim !== null;

  if (editing && idea) {
    return (
      <li className="gift-tag">
        <h3 className="mb-3 text-xl font-bold">Edit secret idea</h3>
        <ItemForm
          action={updateIdeaAction}
          hidden={{ itemId: item.id }}
          initial={item}
          submitLabel="Save idea"
          titleLabel="Gift idea"
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`gift-tag ${gotten ? "bg-sage/40" : ""}`}>
      <div className="flex items-start gap-3">
        {rank !== undefined && (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cranberry font-display text-lg font-bold text-snow"
            aria-label={`Number ${rank}`}
          >
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={`text-xl font-bold break-words ${gotten ? "text-ink-soft" : ""}`}>{item.title}</h3>
            <PriceStamp price={item.price} />
          </div>
          {idea && <p className="font-script text-xl text-pine">Idea from {idea.addedByName}</p>}
          <ItemNotes notes={item.notes} />
          <ItemLink url={item.url} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-parchment pt-3">
        {item.claim ? (
          <>
            <span className="flex items-center gap-2 font-semibold text-pine">
              <WaxSeal className="h-10 w-10 drop-shadow" />
              {item.claim.isMine ? "You're getting this" : `Gotten by ${item.claim.claimerName}`}
            </span>
            {item.claim.isMine && (
              <form action={unclaimAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton variant="quiet" pendingText="Undoing…">
                  Undo
                </SubmitButton>
              </form>
            )}
          </>
        ) : (
          <form action={claim}>
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton pendingText="Marking…">
              <span aria-hidden="true">✓</span> Mark as gotten
            </SubmitButton>
          </form>
        )}
        <span className="flex-1" />
        {idea?.canEdit && (
          <>
            <button type="button" onClick={() => setEditing(true)} className={buttonStyles.ghost}>
              Edit
            </button>
            <form action={deleteIdeaAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <SubmitButton variant="ghost" pendingText="Removing…">
                Remove idea
              </SubmitButton>
            </form>
          </>
        )}
      </div>
      {!item.claim && <div className="mt-2"><FormError message={claimState.error} /></div>}
    </li>
  );
}
