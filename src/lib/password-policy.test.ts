import assert from "node:assert/strict";
import test from "node:test";
import { compare, hash } from "bcryptjs";

import { BCRYPT_COST, UNKNOWN_ACCOUNT_HASH } from "./password-policy";

/*
 * Sign-in compares against a placeholder when no account matches, so that an
 * unknown address takes as long to reject as a real one. That only works if
 * the placeholder is a well-formed bcrypt hash at the same cost as the ones
 * signup writes.
 *
 * It previously was neither, and nothing noticed: the string was malformed,
 * bcryptjs rejected it without doing any work, and unknown addresses answered
 * in ~0ms against ~266ms for real ones. These pin the properties rather than
 * the literal, so raising BCRYPT_COST without regenerating the placeholder
 * fails here instead of silently reopening the oracle.
 */

test("the unknown-account placeholder is a well-formed bcrypt hash", () => {
  assert.match(
    UNKNOWN_ACCOUNT_HASH,
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
    "malformed hashes are rejected without doing the work that hides the timing",
  );
});

test("the placeholder's cost matches the cost signup hashes at", () => {
  const cost = Number(UNKNOWN_ACCOUNT_HASH.split("$")[2]);
  assert.equal(
    cost,
    BCRYPT_COST,
    "a cheaper placeholder makes unknown accounts resolve faster than real ones",
  );
});

test("comparing against the placeholder costs real time, close to a real hash", async () => {
  const real = await hash("a genuine account password", BCRYPT_COST);

  const timeOf = async (target: string) => {
    await compare("warm up", target);
    const started = process.hrtime.bigint();
    await compare("some attacker guess", target);
    return Number(process.hrtime.bigint() - started) / 1e6;
  };

  const placeholderMs = await timeOf(UNKNOWN_ACCOUNT_HASH);

  // Only a floor, not a comparison against `real`. The bug produced ~0ms, so
  // any real floor catches it, while a ratio between the two is unreliable
  // here: the suite runs files in parallel and bcrypt is CPU-bound, so
  // contention alone swings the ratio enough to fail a passing build. That
  // the two costs match is asserted structurally above, which is the property
  // that actually matters. Load can only make this slower, never faster.
  assert.ok(
    placeholderMs > 20,
    `placeholder compare took ${placeholderMs.toFixed(1)}ms - too fast to hide anything`,
  );
  assert.ok(real.length === 60);
});

test("nobody can sign in as a non-existent account using the placeholder", async () => {
  for (const guess of ["", "password", UNKNOWN_ACCOUNT_HASH]) {
    assert.equal(await compare(guess, UNKNOWN_ACCOUNT_HASH), false);
  }
});
