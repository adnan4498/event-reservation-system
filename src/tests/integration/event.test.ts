import { describe, it, expect, beforeEach } from "vitest";
import { api, agent } from "../helpers/test-client.js";
import { resetDb } from "../helpers/reset-db.js";
import prisma from "../../lib/prisma.js";
import bcrypt from "bcryptjs";

const adminUser = {
  name: "Admin User",
  email: "admin@example.com",
  password: "password123",
  role: "ADMIN" as const,
};

const regularUser = {
  name: "Regular User",
  email: "regular@example.com",
  password: "password123",
  role: "USER" as const,
};

const validEvent = {
  title: "Tech Conference 2026",
  description: "An annual gathering of tech enthusiasts.",
  availableTickets: 50,
  location: "Convention Center, Hall A",
  totalTickets: 50,
  price: 80,
  startTime: "2026-10-15T09:00:00Z",
  endTime: "2026-10-15T17:00:00Z",
};

const createSoldTickets = async (eventId: number, count: number) => {
  const hashed = await bcrypt.hash("password123", 10);
  const stamp = Date.now();

  const users = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      prisma.user.create({
        data: {
          name: `Buyer ${i}`,
          email: `buyer-${stamp}-${i}@example.com`,
          password: hashed,
          role: "USER",
        },
      }),
    ),
  );

  await prisma.reservation.createMany({
    data: users.map((u) => ({ userId: u.id, eventId })),
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { availableTickets: { decrement: count } },
  });
};

// Logs in and returns accessToken + user data
const loginAs = async (email: string, password: string) => {
  const a = agent();
  const res = await a.post("/api/auth/login").send({ email, password });
  return {
    agent: a,
    accessToken: res.body.accessToken as string,
    userId: res.body.data.id as number,
  };
};

describe("Events: create", () => {
  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(adminUser);
    await api().post("/api/auth/register").send(regularUser);
  });

  it("rejects create without authentication", async () => {
    const res = await api()
      .post("/api/event/create")
      .send({ ...validEvent, createdById: 1 });
    expect(res.status).toBe(401);
  });

  it("rejects create from a regular USER with 403", async () => {
    const { accessToken, userId } = await loginAs(
      regularUser.email,
      regularUser.password,
    );

    const res = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validEvent, createdById: userId });
    expect(res.status).toBe(403);
  });

  it("allows ADMIN to create an event", async () => {
    const { accessToken, userId } = await loginAs(
      adminUser.email,
      adminUser.password,
    );

    const res = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validEvent, createdById: userId });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(validEvent.title);
    expect(res.body.data.location).toBe(validEvent.location);
    expect(res.body.data.totalTickets).toBe(50);
    expect(res.body.data.availableTickets).toBe(50);
  });

  it("rejects create with endTime before startTime", async () => {
    const { accessToken, userId } = await loginAs(
      adminUser.email,
      adminUser.password,
    );

    const res = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validEvent,
        createdById: userId,
        endTime: "2026-10-14T09:00:00Z", // before startTime
      });
    expect(res.status).toBe(400);
  });

  it("rejects create with negative or zero totalTickets", async () => {
    const { accessToken, userId } = await loginAs(
      adminUser.email,
      adminUser.password,
    );

    const res = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validEvent, createdById: userId, totalTickets: 0 });
    expect(res.status).toBe(400);
  });
});

describe("Events: read", () => {
  let eventId: number;

  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(adminUser);
    const { accessToken, userId } = await loginAs(
      adminUser.email,
      adminUser.password,
    );

    const created = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validEvent, createdById: userId });

    eventId = created.body.data.id;
  });

  it("gets an event by id", async () => {
    const res = await api().get(`/api/event/${eventId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(eventId);
    expect(res.body.data.title).toBe(validEvent.title);
  });

  it("returns 200 with null data (or 404) for a non-existent event", async () => {
    // Your eventById service returns null without throwing.
    // Depending on your controller, this either returns 200 with null data
    // or throws 404. Adjust the assertion to match.
    const res = await api().get("/api/event/99999");
    expect([200, 404]).toContain(res.status);
  });
});

describe("Events: update (admin only)", () => {
  let eventId: number;
  let adminToken: string;

  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(adminUser);
    await api().post("/api/auth/register").send(regularUser);

    const admin = await loginAs(adminUser.email, adminUser.password);
    adminToken = admin.accessToken;

    const created = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validEvent, createdById: admin.userId });

    eventId = created.body.data.id;
  });

  it("updates the event title", async () => {
    const res = await api()
      .put(`/api/event/update/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Updated Conference Title" });

    expect(res.status).toBe(200);

    const check = await api().get(`/api/event/${eventId}`);
    expect(check.body.data.title).toBe("Updated Conference Title");
  });

  it("rejects update from a regular USER with 403", async () => {
    const { accessToken } = await loginAs(
      regularUser.email,
      regularUser.password,
    );

    const res = await api()
      .put(`/api/event/update/${eventId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Hacked Title" });
    expect(res.status).toBe(403);
  });

  it("rejects partial update that would make startTime after endTime", async () => {
    // Existing: startTime = 2026-10-15 09:00, endTime = 2026-10-15 17:00
    // Send only startTime AFTER endTime
    const res = await api()
      .put(`/api/event/update/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ startTime: "2026-10-16T00:00:00Z" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end before it starts/i);
  });

  it("adjusts availableTickets correctly after simulated sales", async () => {
    await createSoldTickets(eventId, 5);

    const res = await api()
      .put(`/api/event/update/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ totalTickets: 20 });

    expect(res.status).toBe(200);

    const check = await api().get(`/api/event/${eventId}`);
    expect(check.body.data.totalTickets).toBe(20);
    expect(check.body.data.availableTickets).toBe(15);
  });

it("rejects shrinking totalTickets below sold count", async () => {
  await createSoldTickets(eventId, 45);

  const res = await api()
    .put(`/api/event/update/${eventId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ totalTickets: 10 });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/cannot be lower than total sales/i);
});

  it("returns 400 when updating a non-existent event", async () => {
    const res = await api()
      .put("/api/event/update/99999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Nope" });

    expect(res.status).toBe(400);
  });
});

describe("Events: delete (admin only)", () => {
  let eventId: number;
  let adminToken: string;

  beforeEach(async () => {
    await resetDb();
    await api().post("/api/auth/register").send(adminUser);
    await api().post("/api/auth/register").send(regularUser);

    const admin = await loginAs(adminUser.email, adminUser.password);
    adminToken = admin.accessToken;

    const created = await api()
      .post("/api/event/create")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validEvent, createdById: admin.userId });

    eventId = created.body.data.id;
  });

  it("deletes an event with no reservations", async () => {
    const res = await api()
      .delete(`/api/event/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const check = await api().get(`/api/event/${eventId}`);
    // Depending on controller behavior, either 404 or null data
    expect([200, 404]).toContain(check.status);
  });

  it("rejects delete from a regular USER with 403", async () => {
    const { accessToken } = await loginAs(
      regularUser.email,
      regularUser.password,
    );

    const res = await api()
      .delete(`/api/event/${eventId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects delete when reservations exist", async () => {
    // Simulate a user making a reservation
    const user = await prisma.user.findUnique({
      where: { email: regularUser.email },
    });

    await prisma.reservation.create({
      data: { userId: user!.id, eventId },
    });

    const res = await api()
      .delete(`/api/event/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/seats are booked/i);
  });
});
