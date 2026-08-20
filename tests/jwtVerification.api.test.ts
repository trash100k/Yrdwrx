import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";

describe("JWT verification algorithm restriction", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  let app: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const { createApp } = await import("../server");
    app = await createApp();
  });

  it("accepts valid HS256 signed magic link token", async () => {
    const validToken = jwt.sign(
      { clientId: "c1", tenantId: "t1", email: "user@example.com", scope: "portal" },
      JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.clientId).toBe("c1");
  });

  it("rejects tokens signed with unauthorized algorithm HS384", async () => {
    const hs384Token = jwt.sign(
      { clientId: "c1", tenantId: "t1", email: "user@example.com", scope: "portal" },
      JWT_SECRET,
      { algorithm: "HS384", expiresIn: "1h" }
    );

    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token: hs384Token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it("rejects portal requests using tokens signed with unauthorized algorithms", async () => {
    const hs384Token = jwt.sign(
      { clientId: "c1", tenantId: "t1", scope: "portal" },
      JWT_SECRET,
      { algorithm: "HS384", expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/portal/data")
      .set("x-portal-token", hs384Token);

    expect(res.status).toBe(401);
  });

  it("rejects tokens signed with RS256 algorithm (algorithm confusion attack prevention)", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });

    const rs256Token = jwt.sign(
      { clientId: "c1", tenantId: "t1", scope: "portal" },
      privateKey,
      { algorithm: "RS256", expiresIn: "1h" }
    );

    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token: rs256Token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
