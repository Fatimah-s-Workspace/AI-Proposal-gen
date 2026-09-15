/**
 * Eval runner.
 *
 *   npm run eval                          all fixtures, heuristic extractor
 *   npm run eval -- --fixture=<slug>      one fixture
 *   npm run eval -- --json                machine-readable report to stdout
 *
 * Evals are measurements, not pass/fail tests, so this is a script rather than
 * a suite under `npm test`. Phase 2 adds baseline comparison; phase 3 adds
 * `--extractor=gemini`.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  extractRequirementsFromClauses,
  extractTenderClausesFromSections,
} from "@/features/tender-intelligence/pipeline";
import {
  extractTextFromBuffer,
  parseTenderSections,
} from "@/features/documents/parser";
import type { ExtractedRequirement } from "@/features/ai";

import { scoreDocument } from "./score";
import type { DocumentScore, GoldenSet } from "./types";

const FIXTURES_DIR = join(process.cwd(), "evals", "fixtures");
const RESULTS_DIR = join(process.cwd(), "evals", "results");

type Extractor = {
  name: string;
  run: (text: string) => Promise<ExtractedRequirement[]>;
};

const heuristic: Extractor = {
  name: "heuristic",
  run: async (text) => {
    const sections = parseTenderSections(text);
    const clauses = extractTenderClausesFromSections(sections);
    return extractRequirementsFromClauses(clauses);
  },
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function pad(value: string, width: number) {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function renderTable(scores: DocumentScore[]) {
  const headers = ["fixture", "recall", "prec", "attrib", "cat", "prio", "exp", "pred", "ms"];
  const rows = scores.map((s) => [
    s.slug,
    pct(s.recall),
    pct(s.precision),
    pct(s.clauseAttribution),
    pct(s.categoryAccuracy),
    pct(s.priorityAccuracy),
    String(s.counts.expected),
    String(s.counts.predicted),
    String(s.latencyMs),
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );

  const line = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i])).join("  ");

  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(line(row));
}

async function main() {
  const extractor = heuristic;
  const only = arg("fixture");
  const asJson = process.argv.includes("--json");

  const slugs = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => !only || slug === only)
    .sort();

  if (!slugs.length) {
    console.error(only ? `No fixture named "${only}".` : "No fixtures found.");
    process.exit(1);
  }

  const scores: DocumentScore[] = [];

  for (const slug of slugs) {
    const dir = join(FIXTURES_DIR, slug);
    const golden = JSON.parse(
      readFileSync(join(dir, "expected.json"), "utf8"),
    ) as GoldenSet;

    const documentPath = join(dir, golden.document);
    const text = await extractTextFromBuffer(
      readFileSync(documentPath),
      "application/pdf",
      golden.document,
    );

    const startedAt = Date.now();
    const predicted = await extractor.run(text);
    const latencyMs = Date.now() - startedAt;

    scores.push(
      scoreDocument({
        slug,
        extractor: extractor.name,
        golden,
        predicted,
        documentText: text,
        latencyMs,
      }),
    );
  }

  const report = {
    extractor: extractor.name,
    ranAt: new Date().toISOString(),
    scores,
    totals: {
      recall: scores.reduce((a, s) => a + s.recall, 0) / scores.length,
      precision: scores.reduce((a, s) => a + s.precision, 0) / scores.length,
      clauseAttribution:
        scores.reduce((a, s) => a + s.clauseAttribution, 0) / scores.length,
    },
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nextractor: ${extractor.name}\n`);
    renderTable(scores);

    for (const s of scores) {
      if (s.missed.length) {
        console.log(`\n${s.slug} — missed ${s.missed.length}/${s.counts.expected}:`);
        for (const m of s.missed) console.log(`  · ${m.title}  [${m.category}/${m.priority}]`);
      }
      const realSpurious = s.spurious.filter((x) => !x.boundary);
      if (realSpurious.length) {
        console.log(`\n${s.slug} — spurious (${realSpurious.length}, excluding ${s.counts.boundaryMisses} on declared boundaries):`);
        for (const x of realSpurious.slice(0, 10)) console.log(`  · ${x.title}`);
        if (realSpurious.length > 10) console.log(`  … ${realSpurious.length - 10} more`);
      }
      if (s.unattributed.length) {
        console.log(`\n${s.slug} — unattributed clauses (${s.unattributed.length}):`);
        for (const x of s.unattributed.slice(0, 5)) console.log(`  · ${x.title}`);
        if (s.unattributed.length > 5) console.log(`  … ${s.unattributed.length - 5} more`);
      }
    }

    console.log(
      `\nmean  recall ${pct(report.totals.recall)}  ·  precision ${pct(report.totals.precision)}  ·  attribution ${pct(report.totals.clauseAttribution)}\n`,
    );
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(RESULTS_DIR, `${extractor.name}-${stamp}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  if (!asJson) console.log(`report: ${out.replace(process.cwd() + "/", "")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
