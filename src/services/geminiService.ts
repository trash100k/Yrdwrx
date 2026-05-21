
import { ApiClient } from "../lib/apiClient";

export async function askMeridianGreen(
  message: string,
  context?: Record<string, unknown>,
) {
  try {
    const data = await ApiClient.post<{ text: string }>("/api/agent/chat", {
      message,
      context,
    });
    return data.text;
  } catch (error) {
    console.error("Chat Service Error:", error);
    return "I'm sorry, neighbor, but I'm having a bit of trouble reaching my thoughts right now. Maybe check back in a minute?";
  }
}

export async function fetchWeather() {
  try {
    return await ApiClient.get<any>("/api/weather");
  } catch (error) {
    console.error("Weather Service Error:", error);
    return null;
  }
}
