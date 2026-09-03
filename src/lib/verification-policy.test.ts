import assert from "node:assert/strict";
import test from "node:test";

import { requiresVerifiedEmail, verificationCutoff } from "./verification-policy";

const CUTOFF = "2026-08-28T00:00:00.000Z";
const env = { EMAIL_VERIFICATION_REQUIRED_AFTER: CUTOFF };

const account = (createdAt: string, emailVerified: string | null = null) => ({
  createdAt: new Date(createdAt),
  emailVerified: emailVerified ? new Date(emailVerified) : null,
});

test("an account created before the cutoff signs in without verifying", () => {
  // The whole point of the cutoff: nobody already using the app is locked out
  // the moment this ships.
  assert.equal(requiresVerifiedEmail(account("2026-08-01T00:00:00.000Z"), env), false);
});

test("an account created after the cutoff must verify", () => {
  assert.equal(requiresVerifiedEmail(account("2026-09-01T00:00:00.000Z"), env), true);
});

test("an account created exactly at the cutoff must verify", () => {
  assert.equal(requiresVerifiedEmail(account(CUTOFF), env), true);
});

test("a verified account is never blocked, however new", () => {
  assert.equal(
    requiresVerifiedEmail(
      account("2027-01-01T00:00:00.000Z", "2027-01-01T00:05:00.000Z"),
      env,
    ),
    false,
  );
});

test("a malformed cutoff falls back instead of disabling the rule", () => {
  // An Invalid Date compares false against everything, so a typo in the
  // variable would silently let every unverified account through.
  const broken = { EMAIL_VERIFICATION_REQUIRED_AFTER: "last tuesday" };
  assert.ok(!Number.isNaN(verificationCutoff(broken).getTime()));
  assert.equal(requiresVerifiedEmail(account("2099-01-01T00:00:00.000Z"), broken), true);
});

test("the cutoff can be moved by configuration", () => {
  const later = { EMAIL_VERIFICATION_REQUIRED_AFTER: "2027-01-01T00:00:00.000Z" };
  assert.equal(requiresVerifiedEmail(account("2026-09-01T00:00:00.000Z"), later), false);
});
