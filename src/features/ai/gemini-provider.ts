import { z } from "zod";

import { GEMINI_MODEL, getGeminiClient, hasGeminiApiKey } from "@/lib/ai/client";

type GeminiJsonInput<TSchema extends z.ZodTypeAny> = {
  schema: Record<string, unknown>;
  validator: TSchema;
  input: string | Array<Record<string, unknown>>;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
};

export type GeminiJsonResult<T> = {
  data: T;
  raw: string;
  provider: "gemini";
  model: string;
};

export async function generateGeminiJson<TSchema extends z.ZodTypeAny>(
  input: GeminiJsonInput<TSchema>,
): Promise<GeminiJsonResult<z.infer<TSchema>> | null> {
  if (!hasGeminiApiKey()) return null;

  const client = getGeminiClient();
  if (!client) return null;

  const model = input.model ?? GEMINI_MODEL;
  const interaction = await client.interactions.create({
    model,
    input: input.input,
    store: false,
    system_instruction: input.systemInstruction,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: input.schema,
    },
    generation_config: {
      temperature: input.temperature ?? 0.2,
    },
  });

  const raw = String(interaction.output_text ?? "").trim();
  if (!raw) throw new Error("Gemini returned an empty response");

  return {
    data: input.validator.parse(parseJson(raw)),
    raw,
    provider: "gemini",
    model,
  };
}

export function parseJson(raw: string) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match?.[1]) return JSON.parse(match[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Gemini response was not valid JSON");
  }
}
