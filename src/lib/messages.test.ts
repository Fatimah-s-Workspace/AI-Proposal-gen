import assert from "node:assert/strict";
import test from "node:test";

import {
  apiErrorMessage,
  authMessages,
  genericMessages,
  signInErrorMessage,
} from "./messages";

/*
 * The sign-in form rendered `result.error` straight to the page. NextAuth
 * reports a wrong password as the bare code "CredentialsSignin", so that is
 * the text people were shown. Confirmed against a running server before
 * these were written.
 */
test("NextAuth codes never reach the user as codes", () => {
  for (const code of [
    "CredentialsSignin",
    "SessionRequired",
    "AccessDenied",
    "Configuration",
    "Verification",
    "Default",
  ]) {
    const message = signInErrorMessage(code);
    assert.ok(!message.includes(code), `"${code}" leaked into "${message}"`);
    assert.match(message, /\s/, "a message should be a sentence, not a token");
  }
});

test("an unrecognised bare code falls back instead of being displayed", () => {
  // New NextAuth versions add codes. An unknown one must not become UI.
  assert.equal(signInErrorMessage("SomeFutureCode"), genericMessages.unexpected);
});

test("messages thrown from authorize() are passed through intact", () => {
  // This is how the throttle and unverified-email notices reach the user;
  // NextAuth surfaces a thrown Error's message verbatim.
  assert.equal(signInErrorMessage(authMessages.tooManyAttempts), authMessages.tooManyAttempts);
  assert.equal(signInErrorMessage(authMessages.emailNotVerified), authMessages.emailNotVerified);
});

test("a missing error still produces something readable", () => {
  assert.equal(signInErrorMessage(null), authMessages.invalidCredentials);
  assert.equal(signInErrorMessage(undefined), authMessages.invalidCredentials);
  assert.equal(signInErrorMessage(""), authMessages.invalidCredentials);
});

test("the credentials failure does not reveal whether the account exists", () => {
  const message = authMessages.invalidCredentials.toLowerCase();
  for (const leak of ["no account", "not found", "unknown", "isn't registered", "no such"]) {
    assert.ok(!message.includes(leak), `"${leak}" would confirm the address is unregistered`);
  }
});

test("the reset notice reads the same whether or not the address is registered", () => {
  assert.match(authMessages.resetLinkSent, /if that address has an account/i);
});

test("no message scolds or shouts", () => {
  const all = [...Object.values(authMessages), ...Object.values(genericMessages)];
  for (const message of all) {
    assert.ok(!message.includes("!"), `exclamation mark in "${message}"`);
    assert.ok(
      !/\byou (failed|must not|cannot|entered .* wrong)\b/i.test(message),
      `blaming phrasing in "${message}"`,
    );
  }
});

const responseOf = (status: number, body?: unknown) =>
  ({
    status,
    json: async () => {
      if (body === undefined) throw new Error("not json");
      return body;
    },
  }) as Response;

test("HTTP status codes map to their own explanations", async () => {
  assert.equal(await apiErrorMessage(responseOf(429)), genericMessages.rateLimited);
  assert.equal(await apiErrorMessage(responseOf(403)), genericMessages.forbidden);
  assert.equal(await apiErrorMessage(responseOf(404)), genericMessages.notFound);
  assert.equal(await apiErrorMessage(responseOf(401)), genericMessages.sessionExpired);
});

test("the API's own wording wins when it sent one", async () => {
  const message = await apiErrorMessage(
    responseOf(400, { error: "Choose a different password." }),
  );
  assert.equal(message, "Choose a different password.");
});

test("a non-JSON body falls back instead of surfacing an HTML error page", async () => {
  // A proxy returning HTML would otherwise be rendered as the error text.
  assert.equal(await apiErrorMessage(responseOf(500)), genericMessages.unexpected);
});

test("a blank error field falls back rather than showing an empty message", async () => {
  assert.equal(await apiErrorMessage(responseOf(400, { error: "   " })), genericMessages.unexpected);
});

test("the unverified notice survives a round trip through signInErrorMessage", () => {
  // The sign-in form decides whether to offer a "send a new link" button by
  // comparing the displayed error against authMessages.emailNotVerified. That
  // comparison is only sound if the message reaches it unchanged - a second
  // copy of the sentence living in auth.ts once broke it silently, leaving
  // the account locked out with the remedy hidden.
  assert.equal(
    signInErrorMessage(authMessages.emailNotVerified),
    authMessages.emailNotVerified,
  );
});

test("no two messages in the vocabulary are duplicates of each other", () => {
  // Duplicated wording is how the two-copies bug started: identical text in
  // two places, compared by value, drifting apart in one edit.
  const all = [...Object.values(authMessages), ...Object.values(genericMessages)];
  assert.equal(new Set(all).size, all.length, "duplicate message text in the vocabulary");
});
