import assert from "node:assert/strict";
import test from "node:test";

import { resetPasswordEmail, welcomeEmail } from "./templates";

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
