import { mkdir, writeFile } from "fs/promises";

type ExportSection = {
  title: string;
  content: string | null;
  order: number;
};

type ExportProject = {
  id: string;
  title: string;
  clientName: string;
  country: string;
  proposalSections: ExportSection[];
};

export async function exportProposal(project: ExportProject, format: "docx" | "pdf") {
  const exportRoot = process.env.EXPORT_DIR ?? "exports";
  await mkdir(exportRoot, { recursive: true });

  const baseName = `${slugify(project.title)}-${Date.now()}`;
  const fileName = `${baseName}.${format}`;
  const filePath = joinStoragePath(exportRoot, fileName);

  if (format === "docx") {
    await exportDocx(project, filePath);
  } else {
    await exportPdf(project, filePath);
  }

  return {
    fileName,
    filePath
  };
}

function joinStoragePath(...parts: string[]) {
  const prefix = parts[0]?.startsWith("/") ? "/" : "";
  return prefix + parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

async function exportDocx(project: ExportProject, filePath: string) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: project.title, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Prepared for ${project.clientName} | ${project.country}` }),
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

  const buffer = await Packer.toBuffer(doc);
  await writeFile(filePath, buffer);
}

async function exportPdf(project: ExportProject, filePath: string) {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 56 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));

  doc.fontSize(22).text(project.title, { lineGap: 8 });
  doc.fontSize(11).fillColor("#475569").text(`Prepared for ${project.clientName} | ${project.country}`);
  doc.moveDown();
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
  await writeFile(filePath, Buffer.concat(chunks));
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
