import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../server.js";

describe("JWT Algorithm Enforcement", () => {
  let app: any;
  const SECRET = "cutty-dev-only-ephemeral-secret";

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    process.env.REQUIRE_AUTH = "true";
    app = await createApp({ startListening: false });
  });

  it("accepts valid HS256 signed magic link token", async () => {
    const validToken = jwt.sign({ clientId: "c1", tenantId: "t1", scope: "portal" }, SECRET, { algorithm: "HS256", expiresIn: "1h" });
    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.clientId).toBe("c1");
  });

  it("rejects token signed with unsupported symmetric algorithm (e.g. HS384)", async () => {
    const hs384Token = jwt.sign({ clientId: "c1", tenantId: "t1", scope: "portal" }, SECRET, { algorithm: "HS384", expiresIn: "1h" });
    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token: hs384Token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it("rejects token with 'none' algorithm or unsigned header", async () => {
    // Construct an unsigned / 'none' algorithm token
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ clientId: "c1", tenantId: "t1", scope: "portal" })).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token: noneToken });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it("rejects portal token with non-HS256 algorithm", async () => {
    const hs384Token = jwt.sign({ clientId: "c1", tenantId: "t1", scope: "portal" }, SECRET, { algorithm: "HS384", expiresIn: "1h" });
    const res = await request(app)
      .get("/api/portal/data")
      .set("x-portal-token", hs384Token);

    expect(res.status).toBe(401);
  });
});
