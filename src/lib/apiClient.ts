import { fetchApi } from "../lib/api";
// @ts-nocheck
import { auth } from "./firebase";

export class ApiError extends Error {
  public status: number;
  public data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  headers?: Record<string, string>;
  retries?: number;
}

export class ApiClient {
  private static baseURL = (import.meta as any).env?.VITE_API_URL || "";

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      throw new ApiError(
        errorData.message || "An API error occurred",
        response.status,
        errorData,
      );
    }

    // In scenarios where 204 No Content is returned
    if (response.status === 204) {
      return {} as T;
    }

    try {
      return await response.json();
    } catch (e) {
      throw new ApiError("Failed to parse JSON response", response.status);
    }
  }

  static async request<T = unknown>(
    endpoint: string,
    options: ApiOptions = {},
  ): Promise<T> {
    const { body, retries = 3, ...customConfig } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(customConfig.headers as Record<string, string>),
    };
    
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers["x-firebase-auth"] = `Bearer ${token}`;
      } catch (e) {
        console.warn("Failed to get Firebase token", e);
      }
    }

    const config: RequestInit = {
      ...customConfig,
      headers,
    };


    if (body) {
      if (body instanceof FormData) {
        config.body = body;
        // fetch automatically sets the correct Content-Type with boundary for FormData
        // We must remove the explicit Content-Type header from the actual config object so the browser can set it
        delete (config.headers as Record<string, string>)["Content-Type"];
      } else {
        config.body = JSON.stringify(body);
      }
    }

    let lastError: unknown;

    let url = `${this.baseURL}${endpoint}`;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      url = endpoint;
    }

    // Simple retry mechanism for network transient errors (not 4xx errors)
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetchApi(url, config);
        return await this.handleResponse<T>(response);
      } catch (error) {
        lastError = error;
        // Do not retry client errors (4xx)
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          throw error;
        }
        // Exponential backoff could be added here
        if (i < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, i)),
          );
        }
      }
    }

    throw lastError;
  }

  static get<T = unknown>(
    endpoint: string,
    options?: Omit<ApiOptions, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  static post<T = unknown>(
    endpoint: string,
    body: unknown,
    options?: Omit<ApiOptions, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...options, body, method: "POST" });
  }

  static put<T = unknown>(
    endpoint: string,
    body: unknown,
    options?: Omit<ApiOptions, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...options, body, method: "PUT" });
  }

  static delete<T = unknown>(
    endpoint: string,
    options?: Omit<ApiOptions, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}
