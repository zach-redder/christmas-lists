"use client";

import { useActionState, useState } from "react";
import { enterPasscodeAction, joinAction, signInAsAction, type JoinState } from "@/server/actions";
import { FormError, inputStyles, SubmitButton } from "./ui";

export function PasscodeForm() {
  const [state, action] = useActionState(enterPasscodeAction, {});
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="passcode" className="block font-semibold">
        Family password
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        required
        autoComplete="current-password"
        autoCapitalize="none"
        className={inputStyles}
      />
      <FormError message={state.error} />
      <SubmitButton variant="red" pendingText="Checking…" className="w-full text-lg">
        Come on in
      </SubmitButton>
    </form>
  );
}

export function NameButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={signInAsAction}>
      <input type="hidden" name="userId" value={id} />
      <SubmitButton variant="ghost" className="w-full font-script text-2xl! text-cranberry">
        {name}
      </SubmitButton>
    </form>
  );
}

export function JoinForm() {
  const [state, action] = useActionState<JoinState, FormData>(joinAction, {});
  const [dismissed, setDismissed] = useState<number | undefined>();

  if (state.taken && state.nonce !== dismissed) {
    return (
      <div className="space-y-3 text-center">
        <p>
          Someone named <strong>{state.taken.name}</strong> is already here. Is that you?
        </p>
        <NameButton id={state.taken.id} name={`Yes, I'm ${state.taken.name}`} />
        <p className="text-sm text-ink-soft">
          Not you? Go back and add a last initial, like &ldquo;{state.taken.name} R.&rdquo;
        </p>
        <button
          type="button"
          onClick={() => setDismissed(state.nonce)}
          className="min-h-11 font-semibold text-pine underline underline-offset-4"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="name" className="block font-semibold">
        Type your name
      </label>
      <input
        id="name"
        name="name"
        required
        maxLength={40}
        autoComplete="given-name"
        placeholder="e.g. Grandma Jo"
        className={inputStyles}
      />
      <FormError message={state.error} />
      <SubmitButton variant="red" pendingText="Joining…" className="w-full text-lg">
        Join the family list
      </SubmitButton>
    </form>
  );
}
