// @ts-nocheck
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

describe("JWT Signature Verification Hardening", () => {
  let app: any;
  const testSecret = "test-jwt-secret-key-12345";

  beforeAll(async () => {
    // Set environment variables for JWT secret
    process.env.JWT_SECRET = testSecret;
    process.env.REQUIRE_AUTH = "true";
    const { createApp } = await import("../server");
    app = await createApp();
  });

  it("accepts valid token signed with HS256 and correct secret", async () => {
    const token = jwt.sign(
      { clientId: "c1", tenantId: "t1", email: "test@example.com" },
      testSecret,
      { algorithm: "HS256" },
    );
    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.clientId).toBe("c1");
  });

  it("rejects token signed with unsupported algorithm HS384", async () => {
    const token = jwt.sign(
      { clientId: "c1", tenantId: "t1", email: "test@example.com" },
      testSecret,
      { algorithm: "HS384" },
    );
    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('rejects token using "none" algorithm', async () => {
    // Construct a token with 'none' algorithm
    const payload = {
      clientId: "c1",
      tenantId: "t1",
      email: "test@example.com",
    };
    const token = jwt.sign(payload, "", { algorithm: "none" });
    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it("rejects algorithm-confusion attempts (e.g. RS256 with symmetric secret as key)", async () => {
    const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC1uVN5O3U3aPV3
FbwY1HK8IEvLXj09UNtkqrJsVl6nTbVRYh8yfDTcYG/FLflgxBdPdLpurNBJGE51
H7g/eYKC2f7afHbgQsuJh6ta2x2EkCKjC9dLqzilYw+QDEHY+eijy2wYiAkse1//
AZHSiEZJG1JE1j0utPPR3f+Skigua6sqWCpUVJcz4zVKIRzP79vyxpq3MCGGl9Zu
Z3oihhyOJFpsf6jzLZ70fd0SDKd6U/jW6dgdeW1H0zMy78bfFjIio9L5p4YIN5eL
XWsyfH8/gT3Ed14zWNWNWhab65R7op6gejuH2eONer6i8CrmGleV3kTbYY//ZpDU
SEIslHsNAgMBAAECggEAFwhayqJdHH1Ko2HXWeRPeIW1ZZzXsTZW4F78R1v5GkZw
pVSE9L6maoo0kG7fzUJ9W95FJPL1YVZZ12GCVlU90/zyXtnorUr6Bj/yWY0tJBiq
szS0gIw+nUO9fLn4/JnMQTpuxHs1gnROugEGbQNFuU1js4Ld9VYNEzwKgRbSTfOz
7KSaWsykOL3H5kiymT0yRwR4QlOoRrjyp9x2xUCB4rwYjKC7Mdy3PUcPoUoDxXQx
TxOn7sgANjY/s5D8292UrGl8pRUY7AAJ9TojmzIgqaK4fw10OLfo9qaWLhkXQvlq
kMZwwvEBP3uwYFLFJ08LnDF6dLfj8KUrWj+p86y78QKBgQDYIrZbNb1XfuRX3lLL
I4kfPUIqPtH078l8tYfTiBSnq+MPjRkSig37/mOZGwhy7yuuSBfclqZh1eDHHQYo
aC0FrmUUsVnrSFfXMKEXCAfCFeoQpBPV7jzTs9YlytPlIBjTaMmLObjNOOvuMvgT
YURWD717JIwLCRtvk9WLHg+gtQKBgQDXPcvI8Xi4xMJwgQGu05gjzuefXjCDJgwG
BeMhGmVm6kyn8JrJDyZKV0BAx5yqiTeF9CO68manVnEnUXMTOkqPrUVp9XgOz88M
dFAI/MZSYY/WVMSDElSluqX8WlZv8epNk7dcJDjnl+JqbOH24P6otgDHDsQd9o1U
ZhfidIZf+QKBgDaUnYRvD7+WtcdSx4mxEaGn8JuGfbLjEvjBRumuRbkJ+S8mLJy3
7Ewks7YoU3vi1h8O6ae1C5NNVZQyyilOFYCHx9Lv7osyG6ymBSgxyPPEYPWO2ct+
fDHiCkRE8jm8X0iT/8F+9CIvK7VdfbQ3LfClzO3aDtuCk0EcDiMxljS5AoGAb4Oi
qu8AHqpCGsubtZoGvraZpiXEeI4juJMgQ6xLUPCe2nt7liN1MRrXPTit4GTLEWmV
gWvI53WPllFKj3Gp45pf1i/JDdN4b/lq5d0gWtoVDXRJg6bhmCOFj6K2GbV6MMsR
OnnByasVMRJMV/3lsj7pVDhAP03Xlxx1z2uTmvECgYBUoYIHvIk5eASSLZO6uEzN
qlXjyDQCyxBFYmHs4CCIU3nr4UVdWoq3PQ4dLw6bJPzwcHoztEWGNmiOz4ErMsM7
MYE87tsujKPF2Q0rJisF/NXrllIUFNt1sd8sCtRH6JhVPqyTKio3+oYkzcr4ACW6
kPdXYbJHUDhGCllpbrJQxg==
-----END PRIVATE KEY-----`;

    const token = jwt.sign(
      { clientId: "c1", tenantId: "t1", email: "test@example.com" },
      privateKey,
      { algorithm: "RS256" },
    );
    const res = await request(app)
      .post("/api/auth/magic-link/validate")
      .send({ token });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
