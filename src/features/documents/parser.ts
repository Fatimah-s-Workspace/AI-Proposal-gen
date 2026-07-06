import type { ParsedSection } from "@/features/ai";

const emptyTextMessage =
  "No machine-readable text was found in this document. Upload a text-based PDF/DOCX or run OCR before final analysis.";

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string, fileName: string) {
  try {
    if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return cleanText(result.text || emptyTextMessage);
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.toLowerCase().endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return cleanText(result.value || emptyTextMessage);
    }

    if (mimeType.startsWith("text/") || fileName.toLowerCase().endsWith(".txt")) {
      return cleanText(buffer.toString("utf8"));
    }
  } catch (error) {
    console.error("Document text extraction failed", error);
  }

  return emptyTextMessage;
}

export function parseTenderSections(text: string): ParsedSection[] {
  const lines = cleanText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines) {
    const isHeading =
      line.length < 90 &&
      (/^(\d+(\.\d+)*\.?\s+)?[A-Z][A-Za-z\s/&,-]+$/.test(line) ||
        /^(scope|eligibility|submission|evaluation|financial|technical|terms|instructions|requirements)/i.test(line));

    if (isHeading) {
      if (current) sections.push(current);
      current = {
        title: line.replace(/^\d+(\.\d+)*\.?\s*/, ""),
        body: "",
        order: sections.length + 1
      };
    } else if (current) {
      current.body += `${line}\n`;
    } else {
      current = {
        title: "Tender overview",
        body: `${line}\n`,
        order: 1
      };
    }
  }

  if (current) sections.push(current);

  return sections
    .map((section, index) => ({
      ...section,
      title: section.title || `Section ${index + 1}`,
      body: section.body.trim(),
      order: index + 1
    }))
    .filter((section) => section.body.length > 20 || section.title.length > 4)
    .slice(0, 20);
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
