// Authed fetch wrapper. Attaches the Supabase Auth access token as a Bearer
// token on /api/* requests so the server can verify identity (see verifySupabaseToken
// in server.ts). In demo mode (no session) the header is simply omitted.
import { getAccessToken } from "./supabase";

export const fetchApi = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : input.toString();
  const config = init || {};

  if (url.startsWith("/api/") || url.includes(window.location.host + "/api/")) {
    try {
      const token = await getAccessToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
          // Back-compat: some routes still read this header name.
          "x-firebase-auth": `Bearer ${token}`,
        };
      }
    } catch (e) {
      console.error("Failed to attach auth token for fetch", e);
    }
  }
  return fetch(input, config); // standard global fetch, avoids window.fetch override issues
};
