import type { Price } from "@/server/schema";

export function PriceStamp({ price }: { price: Price | null }) {
  if (!price) return null;
  const label = price === "$" ? "Small gift" : price === "$$" ? "Medium gift" : "Big gift";
  return (
    <span className="stamp text-sm" title={label}>
      <span aria-hidden="true">{price}</span>
      <span className="sr-only">Price: {label}</span>
    </span>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the website";
  }
}

export function ItemLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex min-h-11 items-center gap-1 font-semibold text-pine underline decoration-fir/50 underline-offset-4 hover:decoration-pine"
    >
      See it on {hostOf(url)} <span aria-hidden="true">↗</span>
    </a>
  );
}

export function ItemNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;
  return <p className="whitespace-pre-line text-ink-soft">{notes}</p>;
}
