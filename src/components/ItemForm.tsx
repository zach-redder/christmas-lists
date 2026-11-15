"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import type { FormState } from "@/server/actions";
import { FormError, inputStyles, SubmitButton } from "./ui";

export type ItemValues = { title: string; url: string | null; notes: string | null; price: string | null };

const PRICE_OPTIONS = [
  { value: "", label: "Skip", hint: "No price" },
  { value: "$", label: "$", hint: "Small" },
  { value: "$$", label: "$$", hint: "Medium" },
  { value: "$$$", label: "$$$", hint: "Big" },
];

export function ItemForm({
  action,
  hidden = {},
  initial,
  submitLabel,
  onDone,
  onCancel,
  titleLabel = "What do you wish for?",
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  hidden?: Record<string, string>;
  initial?: ItemValues;
  submitLabel: string;
  onDone?: () => void;
  onCancel?: () => void;
  titleLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();

  useEffect(() => {
    if (state.ok) {
      if (!initial) formRef.current?.reset();
      onDone?.();
    }
    // only react to a new result from the server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div>
        <label htmlFor={`${id}-title`} className="mb-1 block font-semibold">
          {titleLabel} <span className="text-cranberry">*</span>
        </label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={120}
          defaultValue={initial?.title ?? ""}
          placeholder="e.g. Cozy wool scarf"
          className={inputStyles}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor={`${id}-url`} className="mb-1 block font-semibold">
          Link <span className="font-normal text-ink-soft">(where to find it, optional)</span>
        </label>
        <input
          id={`${id}-url`}
          name="url"
          type="text"
          inputMode="url"
          maxLength={2000}
          defaultValue={initial?.url ?? ""}
          placeholder="Paste a link from the store's website"
          className={inputStyles}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className="mb-1 block font-semibold">
          Notes <span className="font-normal text-ink-soft">(size, color, details, optional)</span>
        </label>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={2}
          maxLength={1000}
          defaultValue={initial?.notes ?? ""}
          placeholder="e.g. Navy blue, size medium"
          className={inputStyles}
        />
      </div>

      <fieldset>
        <legend className="mb-1 font-semibold">About how much?</legend>
        <div className="grid grid-cols-4 gap-2">
          {PRICE_OPTIONS.map((p) => (
            <label key={p.value} className="cursor-pointer">
              <input
                type="radio"
                name="price"
                value={p.value}
                defaultChecked={(initial?.price ?? "") === p.value}
                className="peer sr-only"
              />
              <span className="flex min-h-14 flex-col items-center justify-center rounded-lg border-2 border-parchment bg-snow text-center leading-tight peer-checked:border-cranberry peer-checked:bg-cranberry/10 peer-checked:text-berry-deep peer-focus-visible:outline-3 peer-focus-visible:outline-gold">
                <span className="font-display font-bold">{p.label}</span>
                <span className="text-xs text-ink-soft">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormError message={state.error} />

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center px-4 font-semibold text-ink-soft hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
