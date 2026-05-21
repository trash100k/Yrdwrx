
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
    } catch {
      return {} as T;
    }
  }

  static async request<T = unknown>(
    endpoint: string,
    options: ApiOptions = {},
  ): Promise<T> {
    const { body, retries = 0, ...customConfig } = options;

    const headers = {
      "Content-Type": "application/json",
      ...customConfig.headers,
    };

    const config: RequestInit = {
      ...customConfig,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    let lastError: unknown;

    // Simple retry mechanism for network transient errors (not 4xx errors)
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, config);
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
