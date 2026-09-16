import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * A DPA that under-declares a sub-processor is worse than having none: it is a
 * written promise to a customer's legal team that is already false.
 *
 * This walks the source for outbound calls to third parties and fails if one
 * is not named in the agreement - so adding an integration without declaring
 * it breaks the build rather than being discovered during an audit.
 */

/**
 * Third parties the app sends data to, and the name that must appear in the
 * DPA.
 *
 * Matched on a hostname *or* an SDK import, because most integrations never
 * name their endpoint in our source - the first version of this test looked
 * only for hostnames and reported Gemini as unused while the app was actively
 * sending it every tender document.
 */
const THIRD_PARTIES: Array<{ evidence: string[]; declaredAs: string }> = [
  { evidence: ["generativelanguage.googleapis.com", "@google/genai"], declaredAs: "Gemini" },
  { evidence: ["api.brevo.com"], declaredAs: "Brevo" },
  { evidence: ["api.paystack.co"], declaredAs: "Paystack" },
  { evidence: ["api.pwnedpasswords.com"], declaredAs: "Have I Been Pwned" },
  { evidence: ["@supabase/supabase-js", "supabase"], declaredAs: "Supabase" },
  { evidence: ["@upstash/redis", "upstash"], declaredAs: "Upstash" },
  { evidence: ["@sentry/nextjs", "sentry"], declaredAs: "Sentry" },
];

const isUsed = (evidence: string[], source: string) =>
  evidence.some((marker) => source.includes(marker));

function sourceFiles(dir: string, found: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) {
      found.push(full);
    }
  }
  return found;
}

const dpa = readFileSync("src/app/dpa/page.tsx", "utf8");
const source = sourceFiles("src")
  .filter((f) => !f.includes("src/app/dpa/"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

test("every third party the code talks to is named in the DPA", () => {
  for (const { evidence, declaredAs } of THIRD_PARTIES) {
    if (!isUsed(evidence, source)) continue; // integration removed; nothing to declare
    assert.ok(
      dpa.includes(declaredAs),
      `the code sends data to ${evidence[0]} but the DPA does not name ${declaredAs}`,
    );
  }
});

test("the DPA does not name providers the code no longer uses", () => {
  // An over-declared DPA is less harmful than an under-declared one, but it
  // still misrepresents where data goes.
  for (const { evidence, declaredAs } of THIRD_PARTIES) {
    if (isUsed(evidence, source)) continue;
    assert.ok(
      !dpa.includes(declaredAs),
      `the DPA names ${declaredAs} but nothing in the code calls ${evidence[0]}`,
    );
  }
});

test("the DPA states its own unreviewed status", () => {
  // It is a starting point for legal review, and must not read as though it
  // has already had one.
  assert.match(dpa, /not yet been reviewed by a qualified lawyer/i);
});

test("the DPA commits to the things a buyer will ask about", () => {
  for (const [label, pattern] of [
    ["no training on customer data", /do not use your documents[\s\S]{0,80}train/i],
    ["breach notification window", /within 48 hours/i],
    ["deletion window", /30 days<\/strong>|30 days/i],
    ["sub-processor change notice", /30 days[\s\S]{0,40}notice/i],
  ] as const) {
    assert.match(dpa, pattern, `the DPA is missing: ${label}`);
  }
});
