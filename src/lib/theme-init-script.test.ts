import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { THEME_INIT_SCRIPT } from "./theme-init-script";

// The CSP allows this inline script by hash. If the script is edited and
// the hash in middleware.ts isn't regenerated, the browser silently blocks
// it and dark mode flashes light on every load - a failure that wouldn't
// show up in typecheck, lint, or any rendering test.
test("the CSP hash in middleware matches the theme-init script", () => {
  const expected = createHash("sha256").update(THEME_INIT_SCRIPT, "utf8").digest("base64");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");

  const match = middleware.match(/THEME_SCRIPT_HASH\s*=\s*"'sha256-([^']+)'"/);
  assert.ok(match, "middleware.ts should declare THEME_SCRIPT_HASH");
  assert.equal(
    match[1],
    expected,
    `Theme script changed - update THEME_SCRIPT_HASH in src/middleware.ts to 'sha256-${expected}'`,
  );
});
