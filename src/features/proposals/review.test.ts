import assert from "node:assert/strict";
import test from "node:test";

import {
  PROPOSAL_SECTION_STATUSES,
  isProposalSectionStatus,
  statusAfterEdit,
  statusLabel,
} from "./review";

test("every status has a label a person can read", () => {
  for (const status of PROPOSAL_SECTION_STATUSES) {
    const label = statusLabel(status);
    assert.ok(label.length > 0);
    assert.ok(!label.includes("_"), `"${status}" is showing its raw value`);
  }
});

test("an unknown status from an older row does not render as blank", () => {
  // "ready" was accepted by one of the two routes that used to disagree.
  assert.equal(statusLabel("ready"), "Drafting");
  assert.equal(isProposalSectionStatus("ready"), false);
});

// Editing approved text means the approved text no longer exists. Leaving the
// badge alone would tell the team something untrue about work they signed off.
test("editing an approved section takes it out of approved", () => {
  assert.equal(statusAfterEdit("approved"), "drafting");
  assert.equal(statusAfterEdit("review"), "drafting");
});

test("editing does not overwrite a reviewer asking for changes", () => {
  assert.equal(
    statusAfterEdit("needs_work"),
    "needs_work",
    "the writer is doing the work that was asked for - the request stands until someone acts on it",
  );
});

test("typing in an untouched section starts it drafting", () => {
  assert.equal(statusAfterEdit("not_started"), "drafting");
  assert.equal(statusAfterEdit("drafting"), "drafting");
});
