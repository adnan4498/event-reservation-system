import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the mailer. Path must match how the app imports it.
// If app uses "@src/lib/mailer.js", change the path below to match.
// vi.mock("../../../src/lib/mailer.js", () => ({
//   sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
//   sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
// }));

import { api } from "../helpers/test-client.js";
import { resetDb } from "../helpers/reset-db.js";
import prisma from "../../../src/lib/prisma.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../../src/lib/mailer.js";

const validUser = {
  name: "Email User",
  email: "emailuser@example.com",
  password: "password123",
  role: "USER",
};

const loginAndGetToken = async () => {
  const res = await api().post("/api/auth/login").send({
    email: validUser.email,
    password: validUser.password,
  });
  return res.body.accessToken as string;
};

describe("Email verification", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    await api().post("/api/auth/register").send(validUser);
  });

  it("creates a verification token and sends an email", async () => {
    const token = await loginAndGetToken();

    const res = await api()
      .post("/api/auth/send-verification")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const dbTokens = await prisma.emailVerificationToken.findMany();
    expect(dbTokens).toHaveLength(1);

    const callArgs = vi.mocked(sendVerificationEmail).mock.calls[0]!;
    expect(callArgs[0]).toBe(validUser.email);
    expect(typeof callArgs[1]).toBe("string");
    expect(callArgs[1]).toHaveLength(128);
  });

  it("replaces existing verification tokens (one active per user)", async () => {
    const token = await loginAndGetToken();

    await api()
      .post("/api/auth/send-verification")
      .set("Authorization", `Bearer ${token}`);
    await api()
      .post("/api/auth/send-verification")
      .set("Authorization", `Bearer ${token}`);

    const dbTokens = await prisma.emailVerificationToken.findMany();
    expect(dbTokens).toHaveLength(1);
  });

  it("consumes a verification token exactly once", async () => {
    const token = await loginAndGetToken();
    await api()
      .post("/api/auth/send-verification")
      .set("Authorization", `Bearer ${token}`);

    const rawToken = vi.mocked(sendVerificationEmail).mock.calls[0]![1];

    const first = await api().get(`/api/auth/verify-email?token=${rawToken}`);
    expect(first.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    expect(user?.isVerified).toBe(true);

    const second = await api().get(`/api/auth/verify-email?token=${rawToken}`);
    expect(second.status).toBe(400);
  });

  it("rejects invalid verification token", async () => {
    const res = await api().get("/api/auth/verify-email?token=garbage");
    expect(res.status).toBe(400);
  });

  it("rolls back token when email sending fails", async () => {
    // 1. Silence console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(sendVerificationEmail).mockRejectedValueOnce(
      new Error("SMTP down"),
    );

    const token = await loginAndGetToken();
    const res = await api()
      .post("/api/auth/send-verification")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);

    const dbTokens = await prisma.emailVerificationToken.findMany();
    expect(dbTokens).toHaveLength(0);

    // 2. Restore console.error so other tests can still report real errors
    spy.mockRestore();
  });
});

describe("Password reset", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    await api().post("/api/auth/register").send(validUser);
  });

  it("sends a reset email and creates a token", async () => {
    const res = await api().post("/api/auth/forgot-password").send({
      email: validUser.email,
    });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();

    const dbTokens = await prisma.passwordResetToken.findMany();
    expect(dbTokens).toHaveLength(1);
  });

  it("returns identical response for unknown email (no enumeration)", async () => {
    const known = await api().post("/api/auth/forgot-password").send({
      email: validUser.email,
    });
    const unknown = await api().post("/api/auth/forgot-password").send({
      email: "nobody@example.com",
    });

    expect(known.status).toBe(unknown.status);
    expect(known.body.message).toBe(unknown.body.message);
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it("updates password, revokes sessions, and deletes token atomically", async () => {
    await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    await api()
      .post("/api/auth/forgot-password")
      .send({ email: validUser.email });
    const rawToken = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];

    const reset = await api().post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "newPassword456",
    });
    expect(reset.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    const active = await prisma.refreshToken.count({
      where: { userId: user!.id, revokedAt: null },
    });
    expect(active).toBe(0);

    const remaining = await prisma.passwordResetToken.count({
      where: { userId: user!.id },
    });
    expect(remaining).toBe(0);

    const newLogin = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: "newPassword456",
    });
    expect(newLogin.status).toBe(200);
  });

  it("prevents reset token reuse", async () => {
    await api()
      .post("/api/auth/forgot-password")
      .send({ email: validUser.email });
    const rawToken = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];

    const first = await api().post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "newPassword456",
    });
    expect(first.status).toBe(200);

    const second = await api().post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "anotherPassword789",
    });
    expect(second.status).toBe(400);
  });

  it("rejects expired reset token", async () => {
    await api()
      .post("/api/auth/forgot-password")
      .send({ email: validUser.email });
    const rawToken = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];

    await prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await api().post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "newPassword456",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });
});
