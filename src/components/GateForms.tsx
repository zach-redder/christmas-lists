"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { adminLoginAction, enterPasscodeAction, joinAction, pinSignInAction, type JoinState } from "@/server/actions";
import { buttonStyles, FormError, inputStyles, SubmitButton } from "./ui";

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

/** Tapping a name only picks who you are; the PIN screen proves it. */
export function NameButton({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/sign-in?as=${id}`} className={`${buttonStyles.ghost} w-full font-script text-2xl! text-cranberry`}>
      {name}
    </Link>
  );
}

function PinInput({ id, name, label }: { id: string; name: string; label: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        inputMode="numeric"
        pattern="[0-9]{4}"
        maxLength={4}
        minLength={4}
        required
        autoComplete="off"
        title="4 numbers"
        className={`${inputStyles} text-center font-display text-2xl tracking-[0.5em]`}
      />
    </div>
  );
}

export function PinForm({ userId, name, setup }: { userId: string; name: string; setup: boolean }) {
  const [state, action] = useActionState(pinSignInAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="mode" value={setup ? "setup" : "signin"} />
      <p className="text-center">
        {setup ? (
          <>
            Hi <strong className="font-script text-2xl text-cranberry">{name}</strong>! Pick a 4-number PIN so nobody
            else can sign in as you. You&apos;ll only need it on new devices.
          </>
        ) : (
          <>
            Hi <strong className="font-script text-2xl text-cranberry">{name}</strong>! Enter your 4-number PIN.
          </>
        )}
      </p>
      <PinInput id="pin" name="pin" label={setup ? "Choose your PIN" : "Your PIN"} />
      {setup && <PinInput id="confirm" name="confirm" label="Type it again" />}
      <FormError message={state.error} />
      <SubmitButton variant="red" pendingText="Checking…" className="w-full text-lg">
        {setup ? "Save PIN and sign in" : "Sign in"}
      </SubmitButton>
      {!setup && (
        <p className="text-center text-sm text-ink-soft">Forgot it? Ask whoever runs the site to reset your PIN.</p>
      )}
      <p className="text-center">
        <Link href="/sign-in" className="inline-flex min-h-11 items-center font-semibold text-pine underline underline-offset-4">
          Not {name}? Pick again
        </Link>
      </p>
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
      <PinInput id="join-pin" name="pin" label="Choose a 4-number PIN" />
      <PinInput id="join-confirm" name="confirm" label="Type your PIN again" />
      <p className="text-sm text-ink-soft">Your PIN keeps others from signing in as you. Remember it!</p>
      <FormError message={state.error} />
      <SubmitButton variant="red" pendingText="Joining…" className="w-full text-lg">
        Join the family list
      </SubmitButton>
    </form>
  );
}

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, {});
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="admin-password" className="block font-semibold">
        Admin password
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className={inputStyles}
      />
      <FormError message={state.error} />
      <SubmitButton variant="red" pendingText="Checking…" className="w-full text-lg">
        Sign in as admin
      </SubmitButton>
    </form>
  );
}
