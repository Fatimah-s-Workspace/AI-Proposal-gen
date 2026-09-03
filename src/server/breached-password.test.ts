import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  breachCheckEnabled,
  breachedPasswordMessage,
  checkPasswordBreached,
} from "./breached-password";

const sha1 = (value: string) =>
  createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();

/** A fetch that records the URL it was called with and returns a fixed body. */
function stubFetch(body: string, init: { ok?: boolean } = {}) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    return {
      ok: init.ok ?? true,
      text: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("only the first five hash characters ever leave the server", async () => {
  const password = "Tr0ub4dor&3";
  const digest = sha1(password);
  const { impl, calls } = stubFetch("");

  await checkPasswordBreached(password, impl);

  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith(`/${digest.slice(0, 5)}`));
  // The whole point of k-anonymity: neither the password nor the full digest
  // may appear anywhere in the outbound request.
  assert.ok(!calls[0].includes(password));
  assert.ok(!calls[0].includes(digest.slice(5)));
  assert.ok(!calls[0].includes(digest));
});

test("flags a password whose suffix is in the returned range", async () => {
  const password = "P@ssw0rd1";
  const suffix = sha1(password).slice(5);
  const { impl } = stubFetch(`0000000000000000000000000000000000:3\r\n${suffix}:24230\r\n`);

  const result = await checkPasswordBreached(password, impl);

  assert.deepEqual(result, { status: "breached", count: 24230 });
});

test("passes a password that is not in the returned range", async () => {
  const { impl } = stubFetch("ABCDEF0000000000000000000000000000:9\r\n0011223344556677889900AABBCCDDEEFF:2\r\n");
  const result = await checkPasswordBreached("a genuinely unused passphrase", impl);
  assert.deepEqual(result, { status: "ok" });
});

test("treats a padded zero-count entry as not breached", async () => {
  // The API pads responses with decoy hashes at count 0 so reply size gives
  // nothing away. Counting one as a hit would reject a fine password.
  const password = "Another-Unused-One9!";
  const suffix = sha1(password).slice(5);
  const { impl } = stubFetch(`${suffix}:0\r\n`);

  assert.deepEqual(await checkPasswordBreached(password, impl), { status: "ok" });
});

test("reports unavailable rather than throwing when the service errors", async () => {
  const { impl } = stubFetch("", { ok: false });
  assert.deepEqual(await checkPasswordBreached("anything", impl), { status: "unavailable" });
});

test("reports unavailable when the request fails outright", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;

  // Must not reject: an outage at a third party cannot be allowed to take
  // signup down with it.
  assert.deepEqual(await checkPasswordBreached("anything", failing), {
    status: "unavailable",
  });
});

test("the rejection message names the sighting count", () => {
  assert.match(breachedPasswordMessage(24230), /24,230 known data breaches/);
});

test("the check can be switched off outside production, for the test suite", () => {
  assert.equal(breachCheckEnabled({ NODE_ENV: "test", DISABLE_BREACH_CHECK: "1" }), false);
  assert.equal(breachCheckEnabled({ NODE_ENV: "development" }), true);
});

test("production ignores the off switch entirely", () => {
  // The variable being set in production by mistake must not disable a
  // security control - same shape as demoCredentials.
  assert.equal(
    breachCheckEnabled({ NODE_ENV: "production", DISABLE_BREACH_CHECK: "1" }),
    true,
  );
});

test("a disabled check makes no network call and fails open", async () => {
  let called = false;
  const spy = (async () => {
    called = true;
    return { ok: true, text: async () => "" } as Response;
  }) as unknown as typeof fetch;

  const result = await checkPasswordBreached("password123", spy, {
    NODE_ENV: "test",
    DISABLE_BREACH_CHECK: "1",
  });

  assert.equal(called, false);
  assert.deepEqual(result, { status: "unavailable" });
});
