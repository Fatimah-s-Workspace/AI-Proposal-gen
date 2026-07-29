// Route handlers that import @/lib/auth.ts (essentially every protected
// route) can't be unit-tested via direct import - NextAuth v4's CJS/ESM
// interop only works correctly when Next.js's own bundler processes it,
// not under plain Node/tsx. So integration coverage for these routes has
// to go through real HTTP requests against an actually-running server
// instead. This script starts the dev server, waits for it to accept
// requests, runs the integration test suite against it, then always tears
// the server down - including on test failure or Ctrl-C.
import { spawn } from "node:child_process";

const PORT = process.env.INTEGRATION_TEST_PORT ?? "3100";
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok || response.status < 500) {
          resolve();
          return;
        }
      } catch {
        // Server not accepting connections yet - keep polling.
      }
      if (Date.now() > deadline) {
        reject(new Error(`Server did not become ready within ${timeoutMs}ms`));
        return;
      }
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

async function main() {
  // Production start rather than dev mode: dev's on-demand route
  // compilation, combined with node --test's default of running multiple
  // test files as separate concurrent processes, turned into a real
  // compilation-queue pileup (observed locally: simple 401 checks taking
  // 200+ seconds while unrelated routes compiled in parallel under load).
  // A pre-built server sidesteps that entirely.
  if (!process.env.SKIP_INTEGRATION_BUILD) {
    const build = spawn("npx", ["next", "build"], { stdio: "inherit", shell: true });
    const buildExitCode = await new Promise((resolve) => {
      build.on("exit", (code) => resolve(code ?? 1));
    });
    if (buildExitCode !== 0) process.exit(buildExitCode);
  }

  const server = spawn("npx", ["next", "start", "-p", PORT], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT },
  });

  let exitCode = 1;
  try {
    await waitForServer(BASE_URL, 60_000);

    // --test-concurrency=1: each test file otherwise runs in its own
    // subprocess in parallel by default, which is exactly the pileup
    // described above if anything still needs first-hit work.
    const tests = spawn(
      "node",
      ["--import", "tsx", "--test", "--test-concurrency=1", "integration-tests/**/*.test.ts"],
      {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, INTEGRATION_BASE_URL: BASE_URL },
      },
    );

    exitCode = await new Promise((resolve) => {
      tests.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    server.kill("SIGTERM");
  }

  process.exit(exitCode);
}

main();
