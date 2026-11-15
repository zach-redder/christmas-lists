import { afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import {
  checkAdminPassword,
  familyForPasscode,
  signAdminToken,
  verifyAdminToken,
  signFamilyToken,
  signSessionToken,
  verifyFamilyToken,
  verifySessionToken,
} from "@/server/tokens";

describe("signed tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips a session and rejects tampering", async () => {
    const token = await signSessionToken("user-123", "pinstamp");
    expect(await verifySessionToken(token)).toEqual({ userId: "user-123", pinStamp: "pinstamp" });
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "someone-else" })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s}x`)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(40));
    const token = await signSessionToken("u", "p");
    vi.stubEnv("SESSION_SECRET", "b".repeat(40));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("maps each family's password to that family, case-insensitively", () => {
    vi.stubEnv("FAMILY_PASSCODE", "Snowman26");
    vi.stubEnv("PALMBOS_PASSCODE", "Tinsel");
    expect(familyForPasscode("  snowMAN26 ")?.id).toBe("redder");
    expect(familyForPasscode("tinsel")?.id).toBe("palmbos");
    expect(familyForPasscode("snowman")).toBeNull();
    expect(familyForPasscode("")).toBeNull();
  });

  it("a family token remembers which family it is for", async () => {
    vi.stubEnv("FAMILY_PASSCODE", "one");
    vi.stubEnv("PALMBOS_PASSCODE", "two");
    expect(await verifyFamilyToken(await signFamilyToken("redder"))).toBe("redder");
    expect(await verifyFamilyToken(await signFamilyToken("palmbos"))).toBe("palmbos");
  });

  it("changing one family's password signs out only that family", async () => {
    vi.stubEnv("FAMILY_PASSCODE", "first");
    vi.stubEnv("PALMBOS_PASSCODE", "pine");
    const redder = await signFamilyToken("redder");
    const palmbos = await signFamilyToken("palmbos");
    vi.stubEnv("FAMILY_PASSCODE", "second");
    expect(await verifyFamilyToken(redder)).toBeNull();
    expect(await verifyFamilyToken(palmbos)).toBe("palmbos");
  });

  it("keeps cookies issued before families existed working for the original family", async () => {
    vi.stubEnv("FAMILY_PASSCODE", "classic");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("classic"));
    const stamp = Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    const legacy = await new SignJWT({ fam: stamp })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("s".repeat(40)));
    expect(await verifyFamilyToken(legacy)).toBe("redder");
  });

  it("a family without a configured password is closed in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FAMILY_PASSCODE", "open");
    vi.stubEnv("PALMBOS_PASSCODE", "");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    expect(familyForPasscode("reindeer")).toBeNull();
    expect(familyForPasscode("")).toBeNull();
    expect(familyForPasscode("open")?.id).toBe("redder");
  });

  it("a session token is not accepted as a family token", async () => {
    expect(await verifyFamilyToken(await signSessionToken("u", "p"))).toBeNull();
  });

  it("admin password and cookie; changing the password ends admin sessions; closed when unset in production", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "Holly-Admin");
    expect(checkAdminPassword("Holly-Admin")).toBe(true);
    expect(checkAdminPassword("holly-admin")).toBe(false);
    const token = await signAdminToken();
    expect(await verifyAdminToken(token)).toBe(true);
    expect(await verifyAdminToken(await signSessionToken("u", "p"))).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "changed");
    expect(await verifyAdminToken(token)).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(checkAdminPassword("")).toBe(false);
    expect(checkAdminPassword("admin")).toBe(false);
  });
});
