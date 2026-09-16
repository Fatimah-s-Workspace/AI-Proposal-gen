import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  extractTextFromBuffer,
  hasMachineReadableText,
  parseTenderSections,
} from "./parser";

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

/*
 * Scanned documents were not detected at all.
 *
 * pdf-parse emits its own page markers, so an image-only PDF comes back as
 * "\n\n-- 1 of 1 --\n\n". That is truthy, so the old `result.text || empty`
 * check treated a scanned tender pack as a successful parse with twelve
 * characters of text: marked completed, empty checklist, no explanation.
 * Confirmed against a PDF with zero text-drawing operators and two images.
 */
test("pdf-parse page markers are not mistaken for document text", () => {
  assert.equal(hasMachineReadableText("\n\n-- 1 of 1 --\n\n"), false);
  assert.equal(hasMachineReadableText("\n-- 1 of 12 --\n-- 2 of 12 --\n"), false);
});

test("an empty or whitespace-only extraction is not readable", () => {
  for (const value of ["", "   ", "\n\n\n", "...", "•\t•\t•"]) {
    assert.equal(hasMachineReadableText(value), false, JSON.stringify(value));
  }
});

test("a real page of tender text is readable", () => {
  const page = `
    SECTION 3 - ELIGIBILITY REQUIREMENTS
    3.1 The bidder must attach a valid CAC certificate of incorporation.
    3.2 The bidder shall submit a current tax clearance certificate.
    3.3 Bid security of 2% of the bid price must be provided.
  `;
  assert.equal(hasMachineReadableText(page), true);
});

test("the threshold counts letters and digits, not length", () => {
  // A long string of punctuation is not a document.
  assert.equal(hasMachineReadableText("-".repeat(5000)), false);
  // A short but genuine line of text passes at a lower threshold.
  assert.equal(hasMachineReadableText("The bidder must attach a certificate.", 20), true);
});

test("a genuinely image-only PDF is reported as unreadable, not parsed", async () => {
  // A real scan: one page of tender text rendered to an image and embedded in
  // a PDF. Zero text-drawing operators, two embedded images. This is the exact
  // artifact that exposed the bug - pdf-parse returns "-- 1 of 1 --" for it,
  // which the old truthiness check accepted as a successful parse.
  const buffer = readFileSync(
    new URL("./__fixtures__/scanned-tender-page.pdf", import.meta.url),
  );

  const text = await extractTextFromBuffer(buffer, "application/pdf", "scan.pdf");

  assert.match(
    text,
    /^No machine-readable text was found/,
    "a scanned document must be detected, not silently accepted as parsed",
  );
});
