import { auth } from "./firebase";

export const fetchApi = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  let config = init || {};
  
  if (url.startsWith('/api/') || url.includes(window.location.host + '/api/')) {
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        config.headers = {
          ...config.headers,
          "x-firebase-auth": `Bearer ${token}`
        };
      } catch (e) {
        console.error("Failed to get auth token for fetch", e);
      }
    }
  }
  return fetch(input, config); // Use standard global fetch, avoiding window.fetch override issue
};
