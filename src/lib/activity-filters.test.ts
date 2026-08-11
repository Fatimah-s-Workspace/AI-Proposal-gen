import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ACTIVITY_CATEGORIES,
  categoryPrefixes,
  rangeStart,
  resolveCategory,
  resolveRange,
} from "./activity-filters";

// The filter values arrive from the URL, where anyone can type anything.
// Falling back to "all" is what keeps a junk param from silently producing an
// empty page that looks like "you've never done anything".
test("unknown filter values fall back to showing everything", () => {
  assert.equal(resolveCategory("../etc/passwd"), "all");
  assert.equal(resolveCategory(undefined), "all");
  assert.equal(resolveRange("9999d"), "all");
  assert.equal(resolveRange(undefined), "all");
  assert.equal(resolveCategory("exports"), "exports");
  assert.equal(resolveRange("30d"), "30d");
});

test("'all' narrows nothing, so the query stays unfiltered", () => {
  assert.equal(categoryPrefixes("all"), null);
  assert.equal(rangeStart("all", new Date()), null);
});

test("a category resolves to the action prefixes it covers", () => {
  assert.deepEqual(categoryPrefixes("documents"), ["document."]);
  // Proposal work is logged under two namespaces; a category that only
  // matched one would hide half the user's edits.
  assert.deepEqual(categoryPrefixes("proposals"), [
    "proposal.",
    "proposal_section.",
  ]);
});

test("a range resolves to the right cutoff", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");
  assert.equal(
    rangeStart("7d", now)?.toISOString(),
    "2026-08-04T12:00:00.000Z",
  );
  assert.equal(
    rangeStart("90d", now)?.toISOString(),
    "2026-05-13T12:00:00.000Z",
  );
});

// Every action the app can log has to fall under some category, or it goes
// unreachable the moment a user picks any filter - and nothing else would
// catch that, since adding an action and adding a category are separate
// edits in separate files. Read from source rather than imported: importing
// @/server/audit pulls in the Prisma client, which wants a live DATABASE_URL.
test("every audit action is covered by a category", () => {
  const source = readFileSync(
    new URL("../server/audit.ts", import.meta.url),
    "utf8",
  );
  const block = /AUDIT_ACTIONS = \{([\s\S]*?)\n\} as const;/.exec(source);
  assert.ok(block, "could not find AUDIT_ACTIONS in src/server/audit.ts");

  const actions = [...block[1].matchAll(/"([a-z_]+\.[a-z_]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(actions.length > 0, "expected to find audit actions to check");

  const prefixes = ACTIVITY_CATEGORIES.flatMap((c) => [...c.prefixes]);
  for (const action of actions) {
    assert.ok(
      prefixes.some((prefix) => action.startsWith(prefix)),
      `"${action}" isn't covered by any activity category`,
    );
  }
});
