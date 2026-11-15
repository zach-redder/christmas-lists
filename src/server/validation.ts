import { z } from "zod";
import { PRICES, type Price } from "./schema";

export const LIMITS = { title: 120, notes: 1000, url: 2000 } as const;

export type ItemInput = { title: string; url: string; notes: string; price: string };
export type CleanItem = { title: string; url: string | null; notes: string | null; price: Price | null };

/** null = no link; undefined = invalid link */
function normalizeUrl(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (!url.hostname.includes(".")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please give your wish a name.")
    .max(LIMITS.title, `Keep the name under ${LIMITS.title} letters.`),
  url: z.string().max(LIMITS.url, "That link is too long."),
  notes: z.string().trim().max(LIMITS.notes, `Notes can be up to ${LIMITS.notes} letters.`),
  price: z.union([z.enum(PRICES), z.literal("")]),
});

export function validateItem(
  input: ItemInput,
): { ok: true; item: CleanItem } | { ok: false; message: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const url = normalizeUrl(parsed.data.url);
  if (url === undefined) {
    return { ok: false, message: "That link doesn't look right. Try copying it from the shop's page." };
  }
  return {
    ok: true,
    item: {
      title: parsed.data.title,
      url,
      notes: parsed.data.notes || null,
      price: parsed.data.price || null,
    },
  };
}

export function itemInputFromForm(form: FormData): ItemInput {
  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  return { title: str("title"), url: str("url"), notes: str("notes"), price: str("price") };
}
