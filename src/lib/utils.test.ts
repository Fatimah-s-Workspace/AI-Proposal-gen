import assert from "node:assert/strict";
import test from "node:test";

import { cn, formatCurrency, initials, truncate } from "./utils";

test("cn merges conflicting tailwind classes, keeping the last one", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
});

test("cn drops falsy values", () => {
  assert.equal(cn("a", false, undefined, null, "b"), "a b");
});

test("initials uses the first letter of the first two words", () => {
  assert.equal(initials("Fatimah Davies"), "FD");
});

test("initials handles a single word", () => {
  assert.equal(initials("Fatimah"), "F");
});

test("initials falls back to TF when no name is given", () => {
  assert.equal(initials(null), "TF");
  assert.equal(initials(undefined), "TF");
  assert.equal(initials(""), "TF");
});

test("truncate leaves short text untouched", () => {
  assert.equal(truncate("hello", 10), "hello");
});

test("truncate clips long text and appends an ellipsis", () => {
  const result = truncate("a".repeat(20), 10);
  assert.ok(result.endsWith("..."));
  assert.equal(result, `${"a".repeat(9)}...`);
});

test("formatCurrency formats Naira amounts without decimals", () => {
  const formatted = formatCurrency(500000);
  assert.match(formatted, /500,000/);
});
