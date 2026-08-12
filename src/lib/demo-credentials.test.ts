import assert from "node:assert/strict";
import test from "node:test";

import { demoCredentials } from "./demo-credentials";

const FULL = {
  DEMO_SIGN_IN_EMAIL: "demo@tenderflow.ai",
  DEMO_SIGN_IN_PASSWORD: "password123",
};

// The whole point of this helper. The public sign-in page previously shipped
// a working email and password for an account that also existed in
// production, so the environment check has to hold even when someone sets
// the variables there by mistake.
test("production never prefills, however the variables are set", () => {
  assert.equal(demoCredentials({ ...FULL, NODE_ENV: "production" }), null);
});

test("development prefills only when both halves are present", () => {
  assert.deepEqual(demoCredentials({ ...FULL, NODE_ENV: "development" }), {
    email: "demo@tenderflow.ai",
    password: "password123",
  });

  // Half a credential is not a credential - prefilling just the email would
  // leave a form that looks filled in but cannot be submitted.
  assert.equal(
    demoCredentials({ DEMO_SIGN_IN_EMAIL: "demo@tenderflow.ai", NODE_ENV: "development" }),
    null,
  );
  assert.equal(
    demoCredentials({ DEMO_SIGN_IN_PASSWORD: "password123", NODE_ENV: "development" }),
    null,
  );
  assert.equal(demoCredentials({ NODE_ENV: "development" }), null);
});

test("whitespace-only values count as unset", () => {
  assert.equal(
    demoCredentials({
      DEMO_SIGN_IN_EMAIL: "   ",
      DEMO_SIGN_IN_PASSWORD: "   ",
      NODE_ENV: "development",
    }),
    null,
  );
});
