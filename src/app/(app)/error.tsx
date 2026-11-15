"use client";

import { buttonStyles } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="gift-tag space-y-3 text-center">
      <h1 className="text-3xl font-bold">Oh, fiddlesticks!</h1>
      <p className="text-ink-soft">Something went wrong in Santa&apos;s workshop. Please try again.</p>
      <button type="button" onClick={reset} className={buttonStyles.primary}>
        Try again
      </button>
    </div>
  );
}
