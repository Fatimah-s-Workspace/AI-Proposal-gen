import assert from "node:assert/strict";
import test from "node:test";

import {
  renewalReminderEmail,
  resetPasswordEmail,
  teamInviteEmail,
  verifyEmailEmail,
  welcomeEmail,
} from "./templates";

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

/*
 * The logo in the shared wrapper. These pin the two things that silently
 * break a logo in email: a relative src, which resolves against the mail
 * client's own domain, and a missing alt, which leaves a blank gap for the
 * large share of recipients whose client blocks remote images by default.
 */
test("every email embeds the logo with an absolute URL", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://app.tenderflow.ai";

  try {
    const emails = [
      resetPasswordEmail("https://app.example.com/reset"),
      welcomeEmail("Ada Lovelace"),
      verifyEmailEmail("https://app.example.com/verify"),
      teamInviteEmail("Ada", "Falcons", "https://app.example.com/invite"),
      renewalReminderEmail(3, "https://app.example.com/usage"),
    ];

    for (const { html } of emails) {
      assert.ok(
        html.includes('src="https://app.tenderflow.ai/brand/mark-128.png"'),
        "logo src must be absolute, or mail clients resolve it against their own domain",
      );
      // The mark is decorative: the wordmark beside it is real text, so it
      // survives an image-blocking client on its own. A non-empty alt here
      // would make a screen reader announce the brand twice.
      assert.ok(html.includes('alt=""'), "the mark should be marked decorative");
      assert.match(
        html,
        /TenderFlow <span[^>]*>AI<\/span>/,
        "the wordmark must be HTML text so the header is not blank when images are blocked",
      );
    }
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("logo URL does not double the slash when the base URL has a trailing one", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://app.tenderflow.ai/";

  try {
    const { html } = welcomeEmail("Ada");
    assert.ok(html.includes("https://app.tenderflow.ai/brand/mark-128.png"));
    assert.doesNotMatch(html, /tenderflow\.ai\/\/brand/);
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("every call to action uses the brand teal, not the old near-black", () => {
  const emails = [
    resetPasswordEmail("https://app.example.com/reset"),
    verifyEmailEmail("https://app.example.com/verify"),
    teamInviteEmail("Ada", "Falcons", "https://app.example.com/invite"),
    renewalReminderEmail(3, "https://app.example.com/usage"),
  ];

  for (const { html } of emails) {
    assert.ok(html.includes("background: #0F6B64"), "button should be brand teal");
    assert.ok(!html.includes("#18181b"), "the old near-black button should be gone");
    // Without this the padding collapses in several clients and the button
    // renders as plain underlined text.
    assert.ok(html.includes("display: inline-block"));
  }
});
