/**
 * Treating an uploaded tender as what it is: a file from someone else.
 *
 * Every requirement in a bidder's checklist is derived from document text that
 * goes into a model prompt. Nobody in that chain vouches for the document -
 * it arrives from a procurement portal, an email, or a competitor - and a line
 * of text inside it that reads as an instruction has, until now, been passed
 * to the model in exactly the same way as the buyer's real clauses.
 *
 * Two things are done about that, and it is worth being clear which is which:
 *
 *   Removing characters that cannot be seen. A zero-width space or a Unicode
 *   tag character has no legitimate place in a tender, and hiding an
 *   instruction in them is a known technique. These are deleted outright.
 *
 *   Flagging text that reads as an instruction to an AI. This is a judgement,
 *   not a fact, so it never blocks or edits anything - a genuine addendum can
 *   say "disregard the above". It marks the document so a person looks.
 *
 * What this cannot do: recognise a plausible fake requirement written in
 * ordinary prose. "Bidders must have been incorporated before 1990" is
 * indistinguishable from a real eligibility rule, and no amount of pattern
 * matching will separate them. The defence against that one is the prompt
 * fencing that tells the model the document is data, plus a human reading
 * their own checklist.
 */

export type TrustFindingKind =
  | "invisible_characters"
  | "model_control_tokens"
  | "ai_directed_instruction"
  | "override_language";

export interface TrustFinding {
  kind: TrustFindingKind;
  /** Plain sentence describing what was found, shown to the user. */
  detail: string;
  /** How many times, where counting is meaningful. */
  count: number;
  /** A short excerpt so a person can judge it themselves. */
  sample?: string;
}

export interface DocumentTrustReport {
  /** Text with unseeable characters removed. Use this, not the original. */
  cleanedText: string;
  findings: TrustFinding[];
  /** Whether a person should look before trusting what was extracted. */
  suspicious: boolean;
}

/**
 * Characters that carry no visible meaning in a document of prose.
 *
 * Deleted rather than reported alone, because their only uses here are
 * hiding text and breaking up words to defeat matching. The BOM is included:
 * legitimate at the very start of a file, meaningless anywhere else, and the
 * leading one is stripped separately before this runs.
 *
 * U+E0000-U+E007F are the Unicode tag characters. They render as nothing at
 * all and can encode an entire ASCII sentence, which is precisely why they
 * turn up in real prompt-injection attempts.
 */
const INVISIBLE_PATTERN =
  /[­​-‏‪-‮⁠-⁤⁦-⁯﻿]|[\uDB40][\uDC00-\uDC7F]/g;

/** Tokens that only exist to mark up a conversation with a model. */
const MODEL_CONTROL_PATTERNS: RegExp[] = [
  /<\|[a-z_]+\|>/i,
  /\[\/?INST\]/,
  /<\/?(?:system|assistant)>/i,
  /^\s*(?:system|assistant)\s*:/im,
  /###\s*(?:instruction|system)/i,
];

/** Language addressed to an AI rather than to a bidder. */
const AI_DIRECTED_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|prior|earlier|above|preceding)\s+(?:instruction|prompt|direction|rule)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|earlier)\s+(?:instruction|prompt|direction)/i,
  /you\s+are\s+(?:now\s+)?(?:a|an)\s+[a-z\s]{0,30}(?:assistant|model|ai|bot)/i,
  /\bas\s+an\s+ai\s+(?:language\s+)?model\b/i,
  /\byour\s+(?:new\s+)?(?:instruction|task|role)\s+is\b/i,
  /\b(?:system|developer)\s+prompt\b/i,
  /\bdo\s+not\s+(?:mention|reveal|tell)\s+(?:this|the\s+user|anyone)\b/i,
  /\boutput\s+only\b|\brespond\s+only\s+with\b/i,
];

/**
 * Weaker signals. A real amendment can legitimately say "disregard the
 * above", so these never make a document suspicious on their own.
 */
const OVERRIDE_PATTERNS: RegExp[] = [
  /\bdisregard\s+the\s+(?:above|preceding|foregoing)\b/i,
  /\bignore\s+the\s+(?:above|preceding|foregoing)\b/i,
  /\bnew\s+instructions?\s*:/i,
];

// Asymmetric on purpose. The trigger phrase is "ignore all previous
// instructions"; what a person actually needs to see is what came after it -
// the fake requirement being planted. A symmetric window spent half its room
// on the paragraph before and cut the payload off mid-word.
const SAMPLE_BEFORE = 40;
const SAMPLE_AFTER = 160;

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - SAMPLE_BEFORE);
  const end = Math.min(text.length, index + length + SAMPLE_AFTER);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return { match: match[0], index: match.index };
  }
  return null;
}

function countMatches(text: string, patterns: RegExp[]) {
  let total = 0;
  for (const pattern of patterns) {
    // The patterns are written without /g so exec stays stateless; counting
    // needs a global copy, built per call rather than shared, because a
    // global regex carries lastIndex between uses and would skip matches.
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    total += (text.match(global) ?? []).length;
  }
  return total;
}

export function inspectDocumentText(text: string): DocumentTrustReport {
  if (!text) {
    return { cleanedText: "", findings: [], suspicious: false };
  }

  // A byte-order mark at the very start is ordinary file encoding, not an
  // attempt to hide anything.
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const invisibleMatches = withoutBom.match(INVISIBLE_PATTERN) ?? [];
  const cleanedText = withoutBom.replace(INVISIBLE_PATTERN, "");

  const findings: TrustFinding[] = [];

  if (invisibleMatches.length > 0) {
    findings.push({
      kind: "invisible_characters",
      count: invisibleMatches.length,
      detail:
        invisibleMatches.length === 1
          ? "One character that cannot be seen on the page was removed before this document was read."
          : `${invisibleMatches.length} characters that cannot be seen on the page were removed before this document was read.`,
    });
  }

  // Searched in the cleaned text: an instruction split by zero-width spaces
  // is exactly the case worth catching, and it only becomes visible to these
  // patterns once those characters are gone.
  const control = firstMatch(cleanedText, MODEL_CONTROL_PATTERNS);
  if (control) {
    findings.push({
      kind: "model_control_tokens",
      count: countMatches(cleanedText, MODEL_CONTROL_PATTERNS),
      detail: "This document contains formatting used to give instructions to an AI system.",
      sample: excerptAround(cleanedText, control.index, control.match.length),
    });
  }

  const directed = firstMatch(cleanedText, AI_DIRECTED_PATTERNS);
  if (directed) {
    findings.push({
      kind: "ai_directed_instruction",
      count: countMatches(cleanedText, AI_DIRECTED_PATTERNS),
      detail: "This document contains text written as an instruction to an AI system rather than to a bidder.",
      sample: excerptAround(cleanedText, directed.index, directed.match.length),
    });
  }

  const override = firstMatch(cleanedText, OVERRIDE_PATTERNS);
  if (override) {
    findings.push({
      kind: "override_language",
      count: countMatches(cleanedText, OVERRIDE_PATTERNS),
      detail: "This document tells the reader to disregard something earlier. In an addendum that is normal.",
      sample: excerptAround(cleanedText, override.index, override.match.length),
    });
  }

  // Override language alone is not enough: amendments say this routinely, and
  // a warning that fires on ordinary documents is one people learn to close
  // without reading.
  const suspicious = findings.some(
    (finding) =>
      finding.kind === "model_control_tokens" ||
      finding.kind === "ai_directed_instruction" ||
      finding.kind === "invisible_characters",
  );

  return { cleanedText, findings, suspicious };
}

/** One sentence for the document list, or null when there is nothing to say. */
export function trustNoticeFor(report: DocumentTrustReport): string | null {
  if (!report.suspicious) return null;

  const reasons = report.findings
    .filter((finding) => finding.kind !== "override_language")
    .map((finding) => finding.detail);

  return [
    ...reasons,
    "Requirements extracted from it may not reflect what the buyer actually asked for. Check them against the document before relying on this checklist.",
  ].join(" ");
}
