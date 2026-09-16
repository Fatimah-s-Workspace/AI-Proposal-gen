import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAi,
  checkBilling,
  checkDatabase,
  checkEmail,
  checkRateLimiting,
  checkStorage,
  summarise,
  worstStatus,
} from "./health";

const PROD = { NODE_ENV: "production" };
const DEV = { NODE_ENV: "development" };

/*
 * The point of these checks is that a monitor pages someone for the right
 * things. A check that reports everything as critical trains people to ignore
 * it, which is worse than having none.
 */

test("missing email in production is down, not degraded", () => {
  // New accounts must confirm by email before they can sign in, so no email
  // means signup is broken end to end.
  assert.equal(checkEmail(PROD).status, "down");
  assert.equal(checkBilling(PROD).status, "down");
  assert.equal(checkStorage(PROD).status, "down");
});

test("missing AI in production is degraded, not down", () => {
  // The rule-based pipeline still produces a complete checklist. Paging at 3am
  // for a worse-but-working result is how alerts get muted.
  assert.equal(checkAi(PROD).status, "degraded");
  assert.equal(checkRateLimiting(PROD).status, "degraded");
});

test("nothing configured in development is fine", () => {
  // Local development has a working fallback for all of these; reporting them
  // would make the check meaningless where it runs most often.
  for (const check of [checkEmail, checkStorage, checkAi, checkRateLimiting, checkBilling]) {
    assert.equal(check(DEV).status, "ok", check.name);
  }
});

test("configured services report ok even in production", () => {
  const env = {
    NODE_ENV: "production",
    BREVO_API_KEY: "key",
    SUPABASE_URL: "url",
    SUPABASE_SERVICE_ROLE_KEY: "key",
    UPSTASH_REDIS_REST_URL: "url",
    UPSTASH_REDIS_REST_TOKEN: "token",
    GEMINI_API_KEY: "key",
    PAYSTACK_SECRET_KEY: "key",
  };

  for (const check of [checkEmail, checkStorage, checkAi, checkRateLimiting, checkBilling]) {
    assert.equal(check(env).status, "ok", check.name);
  }
});

test("whitespace is not configuration", () => {
  // A variable set to "" or " " in a dashboard is the same as unset, and is a
  // very easy mistake to make.
  assert.equal(checkEmail({ ...PROD, BREVO_API_KEY: "   " }).status, "down");
  assert.equal(checkAi({ ...PROD, GEMINI_API_KEY: "" }).status, "degraded");
});

test("the database check does a real round trip, and survives a dead one", async () => {
  const working = { $queryRawUnsafe: async () => [{ "?column?": 1 }] };
  assert.equal((await checkDatabase(working as never)).status, "ok");

  const dead = {
    $queryRawUnsafe: async () => {
      throw new Error("connection refused");
    },
  };
  const result = await checkDatabase(dead as never);
  assert.equal(result.status, "down");
  assert.match(result.detail, /connection refused/);
});

test("the worst status wins", () => {
  const ok = { name: "a", status: "ok" as const, detail: "" };
  const degraded = { name: "b", status: "degraded" as const, detail: "" };
  const down = { name: "c", status: "down" as const, detail: "" };

  assert.equal(worstStatus([ok, ok]), "ok");
  assert.equal(worstStatus([ok, degraded]), "degraded");
  assert.equal(worstStatus([ok, degraded, down]), "down");
  assert.equal(worstStatus([]), "ok");
});

test("the summary names what is wrong and stays quiet when nothing is", () => {
  const healthy = {
    status: "ok" as const,
    checkedAt: "",
    checks: [{ name: "database", status: "ok" as const, detail: "" }],
  };
  assert.match(summarise(healthy), /healthy/i);

  const broken = {
    status: "down" as const,
    checkedAt: "",
    checks: [
      { name: "database", status: "ok" as const, detail: "" },
      { name: "email", status: "down" as const, detail: "no key" },
    ],
  };
  const summary = summarise(broken);
  assert.match(summary, /email: down/);
  assert.ok(!summary.includes("database"), "healthy services are not worth alert space");
});
