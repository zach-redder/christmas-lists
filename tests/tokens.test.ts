import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPasscode,
  signFamilyToken,
  signSessionToken,
  verifyFamilyToken,
  verifySessionToken,
} from "@/server/tokens";

describe("signed tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips a session and rejects tampering", async () => {
    const token = await signSessionToken("user-123");
    expect(await verifySessionToken(token)).toBe("user-123");
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "someone-else" })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s}x`)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(40));
    const token = await signSessionToken("u");
    vi.stubEnv("SESSION_SECRET", "b".repeat(40));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("checks the passcode case-insensitively and ignores surrounding spaces", () => {
    vi.stubEnv("FAMILY_PASSCODE", "Snowman26");
    expect(checkPasscode("  snowMAN26 ")).toBe(true);
    expect(checkPasscode("snowman")).toBe(false);
  });

  it("changing the family passcode invalidates existing family cookies", async () => {
    vi.stubEnv("FAMILY_PASSCODE", "first");
    const token = await signFamilyToken();
    expect(await verifyFamilyToken(token)).toBe(true);
    vi.stubEnv("FAMILY_PASSCODE", "second");
    expect(await verifyFamilyToken(token)).toBe(false);
  });

  it("a session token is not accepted as a family token", async () => {
    expect(await verifyFamilyToken(await signSessionToken("u"))).toBe(false);
  });
});
