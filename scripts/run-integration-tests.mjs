// Route handlers that import @/lib/auth.ts (essentially every protected
// route) can't be unit-tested via direct import - NextAuth v4's CJS/ESM
// interop only works correctly when Next.js's own bundler processes it,
// not under plain Node/tsx. So integration coverage for these routes has
// to go through real HTTP requests against an actually-running server
// instead. This script starts the dev server, waits for it to accept
// requests, runs the integration test suite against it, then always tears
// the server down - including on test failure or Ctrl-C.
// Next used to be the only thing here that needed .env, and it loads its own.
// Now this script picks the database before Next starts, so it needs it too.
import "dotenv/config";
import { spawn } from "node:child_process";
import pg from "pg";

const PORT = process.env.INTEGRATION_TEST_PORT ?? "3100";
const BASE_URL = `http://localhost:${PORT}`;

// The suite used to run against whatever DATABASE_URL pointed at - in
// practice the developer's own dev database, shared with their dev server,
// with agent worktrees, and with any `prisma` command in another terminal.
// That made results unreproducible (the same commit passing three times and
// then failing twice within an hour) and left test accounts behind in a
// database people actually use. Everything below exists to give each run its
// own database instead.
const DEFAULT_TEST_DATABASE = "tenderflow_ai_test";

function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set - cannot pick a test database.",
    );
  }

  const url = new URL(base);
  url.pathname = `/${DEFAULT_TEST_DATABASE}`;
  return url.toString();
}

function databaseNameOf(connectionString) {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

/** Connects to the `postgres` maintenance database on the same server. */
function maintenanceUrl(connectionString) {
  const url = new URL(connectionString);
  url.pathname = "/postgres";
  return url.toString();
}

async function ensureDatabase(connectionString) {
  const name = databaseNameOf(connectionString);
  const client = new pg.Client({ connectionString: maintenanceUrl(connectionString) });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [
      name,
    ]);
    if (rowCount === 0) {
      // Identifier can't be parameterised; the name comes from our own env,
      // and quoting it keeps a surprising one from being interpreted.
      await client.query(`create database "${name.replace(/"/g, '""')}"`);
      console.log(`[integration] created database ${name}`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Empties every table before the run. Cheaper than dropping and re-migrating,
 * and it means a run always starts from the same state rather than inheriting
 * whatever the last one left behind.
 */
async function truncateAll(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select tablename from pg_tables
       where schemaname = 'public' and tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
    await client.query(`truncate table ${tables} restart identity cascade`);
  } finally {
    await client.end();
  }
}

function run(command, args, env) {
  const child = spawn(command, args, { stdio: "inherit", shell: true, env });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

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
  const databaseUrl = resolveTestDatabaseUrl();

  // The guards that make the rest of this safe. Everything below creates a
  // database and truncates every table in it.
  if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
    console.error(
      "[integration] refusing to run: the test database is the same as DATABASE_URL.\n" +
        "Set TEST_DATABASE_URL to a separate database.",
    );
    process.exit(1);
  }

  // Comparing against DATABASE_URL alone is not enough. The test URL is that
  // URL with the database name swapped, so if DATABASE_URL points at a remote
  // server the two differ and the check above passes happily - then this
  // creates a database on production and truncates it. Deriving a name is
  // only ever safe against a local server; anywhere else has to be named
  // explicitly, which is a thing you cannot do by accident.
  const host = new URL(databaseUrl).hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host);
  if (!isLocal && !process.env.TEST_DATABASE_URL) {
    console.error(
      `[integration] refusing to run: derived a test database on a remote host (${host}).\n` +
        "DATABASE_URL does not look local. If you really mean to test against\n" +
        "that server, set TEST_DATABASE_URL explicitly.",
    );
    process.exit(1);
  }

  // Every child gets this, so the server, the migrations, and the test
  // process all agree on which database they're talking to. dotenv and
  // Next's own .env loading both leave already-set variables alone, so this
  // wins over the DATABASE_URL in .env.
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    // These tests sign up dozens of accounts against a real server. Without
    // this, every run makes dozens of live calls to Have I Been Pwned, which
    // is slow, flaky when the network is poor, and impolite to a free
    // service. The flag is ignored when NODE_ENV is production, so it cannot
    // silently disable the check on a real deployment.
    DISABLE_BREACH_CHECK: "1",
  };

  await ensureDatabase(databaseUrl);

  const migrateExitCode = await run("npx", ["prisma", "migrate", "deploy"], env);
  if (migrateExitCode !== 0) process.exit(migrateExitCode);

  await truncateAll(databaseUrl);
  console.log(`[integration] using ${databaseNameOf(databaseUrl)} (truncated)`);

  // Production start rather than dev mode: dev's on-demand route
  // compilation, combined with node --test's default of running multiple
  // test files as separate concurrent processes, turned into a real
  // compilation-queue pileup (observed locally: simple 401 checks taking
  // 200+ seconds while unrelated routes compiled in parallel under load).
  // A pre-built server sidesteps that entirely.
  if (!process.env.SKIP_INTEGRATION_BUILD) {
    // `next build` alone does not regenerate the Prisma client - that lives
    // in the `build` npm script. Left stale, the client and the schema
    // disagree and the driver reports it as whatever it happens to hit
    // first, which reads as an unrelated application bug.
    const generateExitCode = await run("npx", ["prisma", "generate"], env);
    if (generateExitCode !== 0) process.exit(generateExitCode);

    const buildExitCode = await run("npx", ["next", "build"], env);
    if (buildExitCode !== 0) process.exit(buildExitCode);
  }

  const server = spawn("npx", ["next", "start", "-p", PORT], {
    stdio: "inherit",
    shell: true,
    env: { ...env, PORT },
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
        env: { ...env, INTEGRATION_BASE_URL: BASE_URL },
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
