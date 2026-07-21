import assert from "node:assert/strict";
import test from "node:test";

import { extractTextFromBuffer, parseTenderSections } from "./parser";

test("parseTenderSections splits headings into separate sections", () => {
  const text = [
    "Tender Overview",
    "This is a general introduction to the opportunity that spans a full line.",
    "Eligibility Requirements",
    "Bidders must provide a valid CAC registration certificate before submission.",
    "Submission Instructions",
    "All bids must be submitted through the online portal before the deadline.",
  ].join("\n");

  const sections = parseTenderSections(text);
  assert.ok(sections.length >= 2);
  assert.ok(sections.some((section) => /eligibility/i.test(section.title)));
});

test("parseTenderSections falls back to a 'Tender overview' section when no heading is found", () => {
  const text =
    "This document has no clear section headings, just a long paragraph of body text that keeps going and going.";
  const sections = parseTenderSections(text);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Tender overview");
});

test("parseTenderSections filters out trivially short sections", () => {
  // Both lines are classified as headings (short, capitalised, no body
  // text follows), so neither the title-length nor body-length side of
  // the keep-filter is satisfied and both get dropped.
  const text = ["Hi", "Ok"].join("\n");
  const sections = parseTenderSections(text);
  assert.equal(sections.length, 0);
});

test("parseTenderSections assigns sequential order starting at 1", () => {
  const text = [
    "Eligibility Requirements",
    "Bidders must provide a valid CAC registration certificate for this opportunity.",
    "Submission Instructions",
    "All bids must be submitted through the online portal before the stated deadline.",
  ].join("\n");

  const sections = parseTenderSections(text);
  sections.forEach((section, index) => {
    assert.equal(section.order, index + 1);
  });
});

test("parseTenderSections caps output at 20 sections", () => {
  const headings = Array.from({ length: 30 }, (_, index) => [
    `Section Heading Number ${index}`,
    `This is the body text for section number ${index} with enough length to survive filtering.`,
  ].join("\n"));

  const sections = parseTenderSections(headings.join("\n"));
  assert.ok(sections.length <= 20);
});

test("extractTextFromBuffer reads plain text files directly", async () => {
  const buffer = Buffer.from("Section 1: Eligibility\nBidders must register with CAC.");
  const text = await extractTextFromBuffer(buffer, "text/plain", "notes.txt");
  assert.match(text, /Eligibility/);
});

test("extractTextFromBuffer normalises excessive blank lines and whitespace", async () => {
  const buffer = Buffer.from("Line one\n\n\n\nLine two   with   extra   spaces");
  const text = await extractTextFromBuffer(buffer, "text/plain", "notes.txt");
  assert.ok(!text.includes("\n\n\n"));
  assert.ok(!text.includes("   "));
});
