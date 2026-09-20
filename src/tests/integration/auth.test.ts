import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../helpers/test-client.js";
import { resetDb } from "../helpers/reset-db.js";
import prisma from "../../lib/prisma.js";

const validUser = {
  name: "Test User",
  email: "test@example.com",
  password: "password123",
  role: "USER",
};

describe("Auth: registration", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("registers a new user", async () => {
    const res = await api().post("/api/auth/register").send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("rejects duplicate email with 409", async () => {
    await api().post("/api/auth/register").send(validUser);
    const res = await api().post("/api/auth/register").send(validUser);
    expect(res.status).toBe(409);
  });
});

describe("Auth: login", () => {
  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(validUser);
  });

  it("logs in with valid credentials and sets refresh cookie", async () => {
    const res = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    if (!cookies) throw new Error("No set-cookie header");
    expect(String(cookies[0])).toMatch(/refreshToken=/);
    expect(String(cookies[0])).toMatch(/HttpOnly/i);
  });

  it("rejects wrong password with 401 (enumeration-safe)", async () => {
    const res = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: "wrong",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("returns identical error for unknown email", async () => {
    const res = await api().post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "whatever",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });
});

describe("Auth: account lockout", () => {
  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(validUser);
  });

  it("locks account after 5 failed logins", async () => {
    for (let i = 0; i < 5; i++) {
      await api().post("/api/auth/login").send({
        email: validUser.email,
        password: "wrong",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    expect(user?.lockoutUntil).not.toBeNull();
    expect(user!.lockoutUntil!.getTime()).toBeGreaterThan(Date.now());

    const res = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/locked/i);
  });

  it("increments failedLoginAttempts for the first four failures", async () => {
    for (let i = 0; i < 3; i++) {
      await api().post("/api/auth/login").send({
        email: validUser.email,
        password: "wrong",
      });
    }
    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    expect(user?.failedLoginAttempts).toBe(3);
    expect(user?.lockoutUntil).toBeNull();
  });

  it("allows login after lockout expires", async () => {
    for (let i = 0; i < 5; i++) {
      await api().post("/api/auth/login").send({
        email: validUser.email,
        password: "wrong",
      });
    }

    await prisma.user.update({
      where: { email: validUser.email },
      data: { lockoutUntil: new Date(Date.now() - 1000) },
    });

    const res = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockoutUntil).toBeNull();
  });

  it("resets counter on successful login", async () => {
    for (let i = 0; i < 3; i++) {
      await api().post("/api/auth/login").send({
        email: validUser.email,
        password: "wrong",
      });
    }

    await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    expect(user?.failedLoginAttempts).toBe(0);
  });
});
