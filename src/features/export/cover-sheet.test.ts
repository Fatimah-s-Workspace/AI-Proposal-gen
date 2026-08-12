import assert from "node:assert/strict";
import test from "node:test";

import { buildCoverSheet, type CoverSheetProject } from "./cover-sheet";

const NOW = new Date("2026-08-11T10:00:00.000Z");

function projectWith(
  overrides: Partial<CoverSheetProject> = {},
): CoverSheetProject {
  return {
    title: "Solar Mini-Grid Grant Proposal",
    clientName: "Rural Electrification Agency",
    country: "Nigeria",
    opportunityType: "Grant",
    ...overrides,
  };
}

function valueOf(rows: ReturnType<typeof buildCoverSheet>["rows"], label: string) {
  return rows.find((row) => row.label === label)?.value;
}

test("the cover carries the facts an evaluator checks first", () => {
  const cover = buildCoverSheet(
    projectWith({
      referenceNumber: "REA/RFP/2026/014",
      authority: "Bureau of Public Procurement",
      contractDuration: "24 months",
      deadline: new Date("2026-09-30T00:00:00.000Z"),
      organization: {
        name: "Acme workspace",
        legalName: "Acme Engineering Services Limited",
        registrationNumber: "RC 1234567",
      },
    }),
    NOW,
  );

  assert.equal(cover.title, "Solar Mini-Grid Grant Proposal");
  assert.equal(cover.subtitle, "Grant proposal");
  assert.equal(valueOf(cover.rows, "Tender reference"), "REA/RFP/2026/014");
  assert.equal(valueOf(cover.rows, "Submitted to"), "Rural Electrification Agency");
  assert.equal(valueOf(cover.rows, "Procuring authority"), "Bureau of Public Procurement");
  assert.equal(
    valueOf(cover.rows, "Submitted by"),
    "Acme Engineering Services Limited",
  );
  assert.equal(valueOf(cover.rows, "Registration number"), "RC 1234567");
  assert.equal(valueOf(cover.rows, "Submission deadline"), "30 September 2026");
  assert.equal(valueOf(cover.rows, "Prepared"), "11 August 2026");
});

// The registered name is what belongs on a submission. The workspace name is
// often just whatever someone typed at signup, so it's a fallback rather than
// a preference.
test("the workspace name stands in only when there is no legal name", () => {
  const withLegal = buildCoverSheet(
    projectWith({
      organization: { name: "Acme workspace", legalName: "Acme Ltd" },
    }),
    NOW,
  );
  assert.equal(valueOf(withLegal.rows, "Submitted by"), "Acme Ltd");

  const withoutLegal = buildCoverSheet(
    projectWith({ organization: { name: "Acme workspace", legalName: "  " } }),
    NOW,
  );
  assert.equal(valueOf(withoutLegal.rows, "Submitted by"), "Acme workspace");
});

// On plenty of tenders the buyer and the procuring authority are the same
// body, and printing it twice reads as filler on a formal document.
test("the authority is dropped when it just repeats the client", () => {
  const cover = buildCoverSheet(
    projectWith({
      clientName: "Rural Electrification Agency",
      authority: "  rural electrification agency ",
    }),
    NOW,
  );

  assert.equal(valueOf(cover.rows, "Procuring authority"), undefined);
  assert.equal(valueOf(cover.rows, "Submitted to"), "Rural Electrification Agency");
});

test("rows with nothing in them are left off entirely", () => {
  const cover = buildCoverSheet(projectWith({ referenceNumber: "" }), NOW);

  // A cover sheet reading "Tender reference: —" invites the question of
  // whether the bidder missed it.
  for (const label of [
    "Tender reference",
    "Registration number",
    "Submission deadline",
    "Contract duration",
    "Submitted by",
  ]) {
    assert.equal(valueOf(cover.rows, label), undefined, `${label} should be absent`);
  }

  // What survives with almost nothing set.
  assert.deepEqual(
    cover.rows.map((row) => row.label),
    ["Submitted to", "Country", "Prepared"],
  );
});

// A deadline entered as a date has no time zone. Formatting it in the
// server's local zone can move it to the previous day, which on a tender
// document is not a cosmetic error.
test("a deadline is formatted in UTC, not the server's zone", () => {
  const original = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    const cover = buildCoverSheet(
      projectWith({ deadline: new Date("2026-09-30T00:00:00.000Z") }),
      NOW,
    );
    assert.equal(valueOf(cover.rows, "Submission deadline"), "30 September 2026");
  } finally {
    process.env.TZ = original;
  }
});

test("the rows keep a fixed order regardless of which are set", () => {
  const cover = buildCoverSheet(
    projectWith({
      referenceNumber: "REF/1",
      deadline: new Date("2026-09-30T00:00:00.000Z"),
      organization: { name: "Acme", registrationNumber: "RC 1" },
    }),
    NOW,
  );

  assert.deepEqual(
    cover.rows.map((row) => row.label),
    [
      "Tender reference",
      "Submitted to",
      "Submitted by",
      "Registration number",
      "Country",
      "Submission deadline",
      "Prepared",
    ],
  );
});
