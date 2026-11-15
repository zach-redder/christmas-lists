export type Result = { ok: true } | { ok: false; message: string };

export const OK: Result = { ok: true };
export const fail = (message: string): Result => ({ ok: false, message });
