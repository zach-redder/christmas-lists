export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="font-script text-2xl text-ink-soft">Checking it twice…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="gift-tag h-28 animate-pulse">
          <div className="h-5 w-2/3 rounded bg-parchment" />
          <div className="mt-3 h-4 w-1/3 rounded bg-parchment/70" />
        </div>
      ))}
    </div>
  );
}
