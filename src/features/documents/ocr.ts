import { GEMINI_MODEL, getGeminiClient } from "@/lib/ai/client";
import { hasMachineReadableText } from "@/features/documents/parser";

/**
 * Reading scanned documents.
 *
 * A large share of Nigerian public procurement arrives as a photocopy: a PDF
 * containing images of pages and no text layer at all. Text extraction returns
 * nothing usable from those, which until now meant an empty checklist.
 *
 * Gemini reads PDFs natively, including scanned ones, so transcription needs no
 * new dependency and no new cost centre - it uses the same free-tier key the
 * rest of the analysis already uses. A dedicated OCR service would be better at
 * this and would also be the first line item on a bill nobody can pay yet.
 */

const OCR_PROMPT = [
  "Transcribe every word of text visible in this document, verbatim and in reading order.",
  "Preserve headings, numbering, and paragraph breaks.",
  "Do not summarise, explain, correct, or add commentary.",
  "If a page is blank or illegible, write [illegible page] and continue.",
  "Output plain text only.",
].join(" ");

export type OcrResult =
  | { status: "ok"; text: string }
  | { status: "unavailable"; reason: "no_api_key" | "too_large" | "failed" };

/**
 * Inline request ceiling.
 *
 * The document is base64-encoded into the request, which inflates it by about
 * a third, and the API rejects oversized inline payloads outright. Refusing at
 * a size we know works beats sending a request we know will fail: the caller
 * can tell the user to split the file, which is something they can act on.
 */
const MAX_OCR_BYTES = 8 * 1024 * 1024;

/** Transcribes a scanned document. Never throws; failure is a return value. */
export async function transcribeScannedDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  const client = getGeminiClient();
  if (!client) return { status: "unavailable", reason: "no_api_key" };

  if (buffer.byteLength > MAX_OCR_BYTES) {
    return { status: "unavailable", reason: "too_large" };
  }

  try {
    const interaction = await client.interactions.create({
      model: GEMINI_MODEL,
      store: false,
      // step_list format. The turn-based shape this SDK also accepts is
      // rejected by this API version with "use step_list input format".
      input: [
        {
          type: "user_input",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "document", mime_type: mimeType, data: buffer.toString("base64") },
          ],
        },
      ] as never,
      generation_config: { temperature: 0 },
    });

    const text = String(interaction.output_text ?? "").trim();

    // A transcription that comes back with no real content is a failure, not a
    // blank document - the same distinction the parser now makes. Returning it
    // as success would replace one silent empty checklist with another.
    if (!hasMachineReadableText(text)) {
      return { status: "unavailable", reason: "failed" };
    }

    return { status: "ok", text };
  } catch {
    // Quota exhaustion, an outage, a malformed file. The caller falls back to
    // telling the user plainly, which is what happened before this existed.
    return { status: "unavailable", reason: "failed" };
  }
}

/** What to tell the user when a scan could not be read. */
export function ocrUnavailableMessage(reason: "no_api_key" | "too_large" | "failed") {
  if (reason === "too_large") {
    return "This looks like a scanned document, and it is too large to read automatically. Split it into files under 8MB and upload them separately.";
  }
  return "This looks like a scanned document rather than a text PDF, and it could not be read automatically. Upload a text-based PDF or DOCX, or run OCR on it first.";
}
