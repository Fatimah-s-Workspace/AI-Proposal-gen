import { saveFile } from "@/lib/storage";
import {
  buildCoverSheet,
  type CoverSheetProject,
} from "@/features/export/cover-sheet";

type ExportSection = {
  title: string;
  content: string | null;
  order: number;
};

type ExportProject = CoverSheetProject & {
  id: string;
  proposalSections: ExportSection[];
};

const mimeTypeByFormat: Record<"docx" | "pdf", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf"
};

export async function exportProposal(project: ExportProject, format: "docx" | "pdf") {
  const baseName = `${slugify(project.title)}-${Date.now()}`;
  const fileName = `${baseName}.${format}`;
  const relativePath = `${project.id}/${fileName}`;

  const buffer = format === "docx" ? await exportDocx(project) : await exportPdf(project);
  const filePath = await saveFile("exports", relativePath, buffer, mimeTypeByFormat[format]);

  return {
    fileName,
    filePath
  };
}

async function exportDocx(project: ExportProject): Promise<Buffer> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const cover = buildCoverSheet(project);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: cover.title, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [new TextRun({ text: cover.subtitle, italics: true })],
            spacing: { after: 400 },
          }),
          ...cover.rows.map(
            (row) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `${row.label}: `, bold: true }),
                  new TextRun(row.value),
                ],
                spacing: { after: 80 },
              }),
          ),
          // The cover is its own page: an evaluator opening the file should
          // see who is bidding and against which reference before any prose.
          new Paragraph({ text: "", pageBreakBefore: true }),
          ...project.proposalSections
            .sort((a, b) => a.order - b.order)
            .flatMap((section) => [
              new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
              ...htmlToParagraphs(section.content || "Draft content pending.").map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun(line)]
                  })
              )
            ])
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
}

async function exportPdf(project: ExportProject): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 56 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));

  const cover = buildCoverSheet(project);

  doc.fontSize(24).fillColor("#111827").text(cover.title, { lineGap: 8 });
  doc.fontSize(12).fillColor("#475569").text(cover.subtitle);
  doc.moveDown(2);

  for (const row of cover.rows) {
    doc.fontSize(10.5).fillColor("#475569").text(`${row.label}`, { lineGap: 2 });
    doc.fontSize(11.5).fillColor("#111827").text(row.value, { lineGap: 6 });
  }

  // The cover is its own page: an evaluator opening the file should see who
  // is bidding and against which reference before any prose.
  doc.addPage();
  doc.fillColor("#111827");

  for (const section of project.proposalSections.sort((a, b) => a.order - b.order)) {
    doc.fontSize(15).fillColor("#0f766e").text(section.title, { lineGap: 6 });
    doc.fontSize(10.5).fillColor("#111827").text(stripHtml(section.content || "Draft content pending."), {
      lineGap: 4,
      align: "left"
    });
    doc.moveDown();
  }

  doc.end();

  await done;
  return Buffer.concat(chunks);
}

function htmlToParagraphs(html: string) {
  return stripHtml(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripHtml(html: string) {
  return html
    .replace(/<h\d[^>]*>/gi, "\n")
    .replace(/<\/h\d>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, " - ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
