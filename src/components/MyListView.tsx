"use client";

import { useState } from "react";
import { addMyItemAction, deleteMyItemAction, moveMyItemAction, updateMyItemAction } from "@/server/actions";
import type { OwnerItem } from "@/server/owner";
import { ItemForm } from "./ItemForm";
import { ItemLink, ItemNotes, PriceStamp } from "./ItemDetails";
import { buttonStyles, SubmitButton } from "./ui";

export function MyListView({ items }: { items: OwnerItem[] }) {
  const [adding, setAdding] = useState(items.length === 0);

  return (
    <div className="space-y-5">
      {adding ? (
        <section className="gift-tag" aria-labelledby="add-wish">
          <h2 id="add-wish" className="mb-3 text-2xl font-bold">
            Add a wish
          </h2>
          <ItemForm
            action={addMyItemAction}
            submitLabel="Add to my list"
            onDone={() => setAdding(false)}
            onCancel={items.length ? () => setAdding(false) : undefined}
          />
        </section>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${buttonStyles.red} w-full text-lg sm:w-auto`}>
          <span aria-hidden="true">＋</span> {items.length ? "Add another wish" : "Add a wish"}
        </button>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center font-script text-2xl text-ink-soft">
          Your list is empty. What&apos;s Santa bringing you this year?
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, index) => (
            <MyListItem key={item.id} item={item} rank={index + 1} isFirst={index === 0} isLast={index === items.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function MyListItem({ item, rank, isFirst, isLast }: { item: OwnerItem; rank: number; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <li className="gift-tag">
        <h3 className="mb-3 text-xl font-bold">Edit wish #{rank}</h3>
        <ItemForm
          action={updateMyItemAction}
          hidden={{ itemId: item.id }}
          initial={item}
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="gift-tag">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cranberry font-display text-lg font-bold text-snow"
          aria-label={`Number ${rank}`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-xl font-bold break-words">{item.title}</h3>
            <PriceStamp price={item.price} />
          </div>
          <ItemNotes notes={item.notes} />
          <ItemLink url={item.url} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-parchment pt-3">
        <div className="flex gap-2">
          <MoveButton itemId={item.id} move="up" disabled={isFirst} label="Move up" symbol="↑" />
          <MoveButton itemId={item.id} move="down" disabled={isLast} label="Move down" symbol="↓" />
          <MoveButton itemId={item.id} move="top" disabled={isFirst} label="Move to top" symbol="⤒" />
        </div>
        <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditing(true)} className={buttonStyles.ghost}>
          Edit
        </button>
        {confirmingDelete ? (
          <form action={deleteMyItemAction} className="flex items-center gap-2">
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton variant="red" pendingText="Removing…">
              Yes, remove it
            </SubmitButton>
            <button type="button" onClick={() => setConfirmingDelete(false)} className={buttonStyles.quiet}>
              Keep it
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirmingDelete(true)} className={buttonStyles.ghost}>
            Remove
          </button>
        )}
        </div>
      </div>
    </li>
  );
}

function MoveButton({
  itemId,
  move,
  disabled,
  label,
  symbol,
  showLabel,
}: {
  itemId: string;
  move: "up" | "down" | "top";
  disabled?: boolean;
  label: string;
  symbol: string;
  showLabel?: boolean;
}) {
  return (
    <form action={moveMyItemAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="move" value={move} />
      <SubmitButton
        variant="ghost"
        disabled={disabled}
        aria-label={showLabel ? undefined : label}
        title={label}
        className="min-w-12 px-3 text-lg"
      >
        <span aria-hidden="true">{symbol}</span>
        {showLabel && <span className="text-base">{label}</span>}
      </SubmitButton>
    </form>
  );
}
