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
