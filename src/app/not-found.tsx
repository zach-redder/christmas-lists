import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="gift-tag max-w-md space-y-3 text-center">
        <h1 className="text-3xl font-bold">Lost in the snow</h1>
        <p className="text-ink-soft">We couldn&apos;t find that page or person.</p>
        <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-pine underline underline-offset-4">
          Back home
        </Link>
      </div>
    </main>
  );
}
