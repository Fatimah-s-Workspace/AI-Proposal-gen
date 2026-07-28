import assert from "node:assert/strict";
import test from "node:test";

import { renewalReminderEmail, resetPasswordEmail, welcomeEmail } from "./templates";

test("resetPasswordEmail includes the reset URL in text and html", () => {
  const url = "https://app.example.com/auth/reset-password?token=abc&email=a%40b.com";
  const { subject, text, html } = resetPasswordEmail(url);

  assert.match(subject, /reset/i);
  assert.ok(text.includes(url));
  assert.ok(html.includes(url));
});

test("welcomeEmail includes the user's name in text and html", () => {
  const { subject, text, html } = welcomeEmail("Ada Lovelace");

  assert.match(subject, /welcome/i);
  assert.ok(text.includes("Ada Lovelace"));
  assert.ok(html.includes("Ada Lovelace"));
});

test("renewalReminderEmail includes the day count and billing link", () => {
  const url = "https://app.example.com/usage";
  const { subject, text, html } = renewalReminderEmail(3, url);

  assert.match(subject, /3 days/);
  assert.ok(text.includes(url));
  assert.ok(html.includes(url));
});

test("renewalReminderEmail singularizes 'day' when exactly 1 day remains", () => {
  const { subject } = renewalReminderEmail(1, "https://app.example.com/usage");
  assert.match(subject, /1 day\b/);
  assert.doesNotMatch(subject, /1 days/);
});

test("renewalReminderEmail uses an 'expires today' subject when 0 or fewer days remain", () => {
  const { subject } = renewalReminderEmail(0, "https://app.example.com/usage");
  assert.match(subject, /expires today/i);
});
