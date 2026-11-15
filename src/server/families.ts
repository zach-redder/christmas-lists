/**
 * The families that share this site. Each family has its own password (an env var);
 * the password you enter decides which family you join, and families never see each other.
 * No Next.js imports, so this works in proxy.ts, server code, and tests.
 */
export const FAMILIES = [
  // The original family: existing rows default to "redder" and keep using FAMILY_PASSCODE.
  { id: "redder", name: "Redder", passcodeEnv: "FAMILY_PASSCODE", devPasscode: "snowman" },
  { id: "palmbos", name: "Palmbos", passcodeEnv: "PALMBOS_PASSCODE", devPasscode: "reindeer" },
] as const;

export type Family = (typeof FAMILIES)[number];
export type FamilyId = Family["id"];

export const DEFAULT_FAMILY_ID: FamilyId = "redder";

export function getFamily(id: unknown): Family | null {
  return FAMILIES.find((f) => f.id === id) ?? null;
}
