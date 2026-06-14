import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiError } from "./apiClient";
import { fetchApi } from "./api";
import { auth } from "./firebase";

vi.mock("./api", () => ({
  fetchApi: vi.fn(),
}));

vi.mock("./firebase", () => ({
  auth: {
    currentUser: null,
  },
}));

describe("ApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("API Error Generation", () => {
    it("should throw ApiError with JSON message for 4xx responses", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Bad Request details" }), {
          status: 400,
          statusText: "Bad Request",
        })
      );

      await expect(ApiClient.get("/test", { retries: 0 })).rejects.toThrowError(
        new ApiError("Bad Request details", 400, { message: "Bad Request details" })
      );
    });

    it("should throw ApiError with statusText for invalid JSON", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response("invalid json", {
          status: 500,
          statusText: "Internal Server Error",
        })
      );

      await expect(ApiClient.get("/test", { retries: 0 })).rejects.toThrowError(
        new ApiError("Internal Server Error", 500, { message: "Internal Server Error" })
      );
    });

    it("should throw ApiError with fallback message if JSON is missing 'message'", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({ otherData: "value" }), {
          status: 403,
          statusText: "Forbidden",
        })
      );

      await expect(ApiClient.get("/test", { retries: 0 })).rejects.toThrowError(
        new ApiError("An API error occurred", 403, { otherData: "value" })
      );
    });
  });

  describe("Response Handling", () => {
    it("should return empty object for 204 No Content", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          statusText: "No Content",
        })
      );

      const result = await ApiClient.get("/test");
      expect(result).toEqual({});
    });

    it("should return empty object for valid 200 response with invalid JSON", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response("invalid json", {
          status: 200,
          statusText: "OK",
        })
      );

      const result = await ApiClient.get("/test");
      expect(result).toEqual({});
    });

    it("should return parsed JSON for valid 200 response", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "success" }), {
          status: 200,
          statusText: "OK",
        })
      );

      const result = await ApiClient.get("/test");
      expect(result).toEqual({ data: "success" });
    });
  });

  describe("Retry Logic", () => {
    it("should not retry on 4xx client errors", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          statusText: "Not Found",
        })
      );

      await expect(ApiClient.get("/test", { retries: 3 })).rejects.toThrowError(ApiError);
      expect(fetchApi).toHaveBeenCalledTimes(1);
    });

    it("should retry on 5xx server errors", async () => {
      vi.mocked(fetchApi)
        .mockRejectedValueOnce(new Error("Network Failure 1"))
        .mockRejectedValueOnce(new Error("Network Failure 2"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: "success" }), { status: 200 })
        );

      const result = await ApiClient.get("/test", { retries: 2 });

      expect(result).toEqual({ data: "success" });
      expect(fetchApi).toHaveBeenCalledTimes(3);
    });

    it("should throw last error if retries are exhausted", async () => {
      vi.mocked(fetchApi)
        .mockRejectedValueOnce(new Error("Network Error 1"))
        .mockRejectedValueOnce(new Error("Network Error 2"))
        .mockRejectedValueOnce(new Error("Network Error 3"));

      await expect(ApiClient.get("/test", { retries: 2 })).rejects.toThrow("Network Error 3");
      expect(fetchApi).toHaveBeenCalledTimes(3);
    });
  });

  describe("API Methods", () => {
    it("should correctly forward GET requests", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await ApiClient.get("/test", { headers: { custom: "header" } });
      expect(fetchApi).toHaveBeenCalledWith("/test", expect.objectContaining({ method: "GET" }));
    });

    it("should correctly forward POST requests", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await ApiClient.post("/test", { foo: "bar" });
      expect(fetchApi).toHaveBeenCalledWith("/test", expect.objectContaining({ method: "POST", body: '{"foo":"bar"}' }));
    });

    it("should correctly forward PUT requests", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await ApiClient.put("/test", { foo: "baz" });
      expect(fetchApi).toHaveBeenCalledWith("/test", expect.objectContaining({ method: "PUT", body: '{"foo":"baz"}' }));
    });

    it("should correctly forward DELETE requests", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await ApiClient.delete("/test");
      expect(fetchApi).toHaveBeenCalledWith("/test", expect.objectContaining({ method: "DELETE" }));
    });
  });

  describe("Headers and Auth", () => {
    it("should add Firebase auth token if user is authenticated", async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      Object.defineProperty(auth, "currentUser", { value: {
        getIdToken: vi.fn().mockResolvedValue("mock-token"),
      } as any, configurable: true });

      await ApiClient.get("/test");

      expect(fetchApi).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-firebase-auth": "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should handle error gracefully if getting auth token fails", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      vi.mocked(fetchApi).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      Object.defineProperty(auth, "currentUser", { value: {
        getIdToken: vi.fn().mockRejectedValue(new Error("Token failed")),
      } as any, configurable: true });

      await ApiClient.get("/test");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Failed to get Firebase token", expect.any(Error));
      expect(fetchApi).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
