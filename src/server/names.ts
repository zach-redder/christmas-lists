export const MAX_NAME_LENGTH = 40;

export type NormalizedName =
  | { ok: true; name: string; nameKey: string }
  | { ok: false; message: string };

export function normalizeName(raw: string): NormalizedName {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, message: "Please type your name." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, message: `Names can be up to ${MAX_NAME_LENGTH} letters.` };
  }
  return { ok: true, name, nameKey: name.toLowerCase() };
}
