// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(userId: string, email: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly auth-token cookie", async () => {
    await createSession("user-1", "a@b.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, _token, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBeInstanceOf(Date);
  });

  test("cookie expiry is ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "a@b.com");
    const after = Date.now();

    const expires: Date = mockCookieStore.set.mock.calls[0][2].expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 100);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 100);
  });

  test("secure flag is false outside production", async () => {
    await createSession("user-1", "a@b.com");
    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.secure).toBe(false);
  });

  test("secure flag is true in production", async () => {
    const original = process.env.NODE_ENV;
    // @ts-expect-error NODE_ENV is typed as a const but is writable at runtime in vitest
    process.env.NODE_ENV = "production";
    await createSession("user-1", "a@b.com");
    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.secure).toBe(true);
    // @ts-expect-error
    process.env.NODE_ENV = original;
  });

  test("calls cookieStore.set exactly once per invocation", async () => {
    await createSession("u1", "a@b.com");
    await createSession("u2", "c@d.com");
    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
  });

  test("cookie token is a valid JWT containing userId and email", async () => {
    await createSession("user-1", "a@b.com");

    const token = mockCookieStore.set.mock.calls[0][1] as string;
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
  });

  test("JWT payload contains an expiresAt ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "a@b.com");
    const after = Date.now();

    const token = mockCookieStore.set.mock.calls[0][1] as string;
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const expiresAt = new Date(payload.expiresAt as string).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 100);
    expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs + 100);
  });

  test("JWT is signed with HS256", async () => {
    await createSession("user-1", "a@b.com");
    const token = mockCookieStore.set.mock.calls[0][1] as string;
    const header = JSON.parse(atob(token.split(".")[0]));
    expect(header.alg).toBe("HS256");
  });

  test("different users produce different tokens", async () => {
    await createSession("user-1", "a@b.com");
    const token1 = mockCookieStore.set.mock.calls[0][1] as string;
    vi.clearAllMocks();
    await createSession("user-2", "c@d.com");
    const token2 = mockCookieStore.set.mock.calls[0][1] as string;
    expect(token1).not.toBe(token2);
  });
});

async function makeExpiredToken(userId: string, email: string) {
  const expiresAt = new Date(Date.now() - 1000);
  return new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("-1s")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null when cookie value is an empty string", async () => {
    mockCookieStore.get.mockReturnValue({ value: "" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a tampered token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeExpiredToken("user-x", "x@y.com");
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "user-z", email: "z@z.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(wrongSecret);
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken("user-2", "c@d.com");
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("c@d.com");
  });

  test("returned payload contains userId, email, and expiresAt", async () => {
    const token = await makeToken("user-4", "g@h.com");
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).toMatchObject({
      userId: "user-4",
      email: "g@h.com",
      expiresAt: expect.anything(),
    });
  });

  test("does not call cookieStore.set or delete", async () => {
    const token = await makeToken("user-5", "i@j.com");
    mockCookieStore.get.mockReturnValue({ value: token });

    await getSession();
    expect(mockCookieStore.set).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when request has no cookie", async () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for an invalid token in the request", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "auth-token=garbage" },
    });
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for an expired token in the request", async () => {
    const token = await makeExpiredToken("user-x", "x@y.com");
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: `auth-token=${token}` },
    });
    expect(await verifySession(req)).toBeNull();
  });

  test("returns session payload for a valid token in the request", async () => {
    const token = await makeToken("user-3", "e@f.com");
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: `auth-token=${token}` },
    });

    const session = await verifySession(req);
    expect(session?.userId).toBe("user-3");
    expect(session?.email).toBe("e@f.com");
  });
});
