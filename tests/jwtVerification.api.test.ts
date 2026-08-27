// @ts-nocheck
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

describe("JWT verification algorithm enforcement", () => {
  let app: any;
  const JWT_SECRET = "test-jwt-secret-key-1234567890";

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.REQUIRE_AUTH = "false";
    const { createApp } = await import("../server");
    app = await createApp();
  });

  it("accepts HS256 and rejects HS384/untrusted tokens", async () => {
    const validToken = jwt.sign({ clientId: "c1", scope: "portal" }, JWT_SECRET, { algorithm: "HS256" });
    const hs384Token = jwt.sign({ clientId: "c1", scope: "portal" }, JWT_SECRET, { algorithm: "HS384" });

    const okRes = await request(app).post("/api/auth/magic-link/validate").send({ token: validToken });
    expect(okRes.status).toBe(200);

    const badRes = await request(app).post("/api/auth/magic-link/validate").send({ token: hs384Token });
    expect(badRes.status).toBe(401);

    const portalRes = await request(app).get("/api/portal/data").set("x-portal-token", hs384Token);
    expect(portalRes.status).toBe(401);
  });
});
