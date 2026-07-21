import { GoogleGenAI } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export function getGeminiClient() {
  if (!hasGeminiApiKey()) return null;

  if (!geminiClient) {
    geminiClient = ai;
  }
  return geminiClient;
}

// Free-tier quota exhaustion (429/RESOURCE_EXHAUSTED) and transient
// availability errors (503/overloaded) should degrade to the local
// fallback instead of failing the user's request.
export function isGeminiQuotaOrAvailabilityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate.?limit|overloaded/i.test(
    message,
  );
}
