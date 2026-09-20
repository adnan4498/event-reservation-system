import { describe, it, expect, beforeEach } from "vitest";
import { api, agent } from "../helpers/test-client.js";
import { resetDb } from "../helpers/reset-db.js";
import prisma from "../../lib/prisma.js";

const validUser = {
  name: "Session User",
  email: "session@example.com",
  password: "password123",
  role: "USER",
};

const loginAsAgent = async () => {
  const a = agent();
  const res = await a.post("/api/auth/login").send({
    email: validUser.email,
    password: validUser.password,
  });
  return { agent: a, accessToken: res.body.accessToken as string };
};

describe("Session management", () => {
  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(validUser);
  });

  it("uses access token on protected routes", async () => {
    const { accessToken } = await loginAsAgent();
    const res = await api()
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it("rejects protected route without access token", async () => {
    const res = await api().get("/api/auth/sessions");
    expect(res.status).toBe(401);
  });

  it("rotates refresh token on refresh", async () => {
    const { agent: a } = await loginAsAgent();
    
    const before = await prisma.refreshToken.count();
    
    const res = await a.post("/api/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    const after = await prisma.refreshToken.count();
    expect(after).toBe(before + 1); // old revoked, new created
  });

  it("detects refresh token reuse and revokes the family", async () => {
    const loginRes = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    const cookies = loginRes.headers["set-cookie"];
    if (!cookies || !cookies[0]) throw new Error("No set-cookie header");
    const originalCookie = String(cookies[0]).split(";")[0];
    if (!originalCookie) throw new Error("Malformed cookie");

    const refresh1 = await api()
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie);
    expect(refresh1.status).toBe(200);

    const replay = await api()
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/reuse/i);

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    const active = await prisma.refreshToken.count({
      where: { userId: user!.id, revokedAt: null },
    });
    expect(active).toBe(0);
  });

  it("flags isCurrent correctly in session list", async () => {
    const { agent: a, accessToken } = await loginAsAgent();
    await loginAsAgent();

    const res = await a
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const currentCount = res.body.data.filter((s: any) => s.isCurrent).length;
    expect(currentCount).toBe(1);
  });

  it("revokes a specific session by id", async () => {
    const dev1 = await loginAsAgent();
    const dev2 = await loginAsAgent();

    const list = await dev1.agent
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${dev1.accessToken}`);

    const other = list.body.data.find((s: any) => !s.isCurrent);
    expect(other).toBeDefined();

    const del = await dev1.agent
      .delete(`/api/auth/sessions/${other.id}`)
      .set("Authorization", `Bearer ${dev1.accessToken}`);
    expect(del.status).toBe(204);

    const refresh2 = await dev2.agent.post("/api/auth/refresh");
    expect(refresh2.status).toBe(401);
  });

  it("returns 404 when revoking another user's session", async () => {
    await loginAsAgent();

    const registerRes = await api().post("/api/auth/register").send({
      name: "Other",
      email: "other@example.com",
      password: "password123",
      role: "USER",
    });
    expect(registerRes.status).toBe(201);

    const other = agent();
    const otherLogin = await other.post("/api/auth/login").send({
      email: "other@example.com",
      password: "password123",
    });
    expect(otherLogin.status).toBe(200);

    const userA = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    const sessionA = await prisma.refreshToken.findFirst({
      where: { userId: userA!.id, revokedAt: null },
    });

    const res = await other
      .delete(`/api/auth/sessions/${sessionA!.id}`)
      .set("Authorization", `Bearer ${otherLogin.body.accessToken}`);
    expect(res.status).toBe(404);
  });

  it("revokes all other sessions when cookie is present", async () => {
    const dev1 = await loginAsAgent();
    const dev2 = await loginAsAgent();
    const dev3 = await loginAsAgent();

    const res = await dev1.agent
      .delete("/api/auth/sessions")
      .set("Authorization", `Bearer ${dev1.accessToken}`);
    expect(res.status).toBe(200);

    expect((await dev1.agent.post("/api/auth/refresh")).status).toBe(200);
    expect((await dev2.agent.post("/api/auth/refresh")).status).toBe(401);
    expect((await dev3.agent.post("/api/auth/refresh")).status).toBe(401);
  });

  it("returns 400 when revoking all without cookie", async () => {
    const loginRes = await api().post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    const res = await api()
      .delete("/api/auth/sessions")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cookie/i);

    const user = await prisma.user.findUnique({
      where: { email: validUser.email },
    });
    const active = await prisma.refreshToken.count({
      where: { userId: user!.id, revokedAt: null },
    });
    expect(active).toBe(1);
  });
});
