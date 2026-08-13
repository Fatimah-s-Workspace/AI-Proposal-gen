import { GoogleGenAI } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;

// The default has to be a model that actually answers. gemini-2.5-flash was
// the previous default and Google now returns 404 "no longer available to
// new users" for it - production hit exactly that on 2026-07-13, and every
// generation failed hard until GEMINI_MODEL was set explicitly. A default
// that only works for callers who already overrode it is not a default.
//
// gemini-3.5-flash is the only model with a successful generation on record
// here (12 of them). Check https://ai.google.dev/gemini-api/docs/models
// before changing it - a wrong value fails every request with a 404.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

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
