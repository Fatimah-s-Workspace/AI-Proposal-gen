export type DemoCredentials = { email: string; password: string };

/**
 * The seeded demo login, for local development only.
 *
 * The sign-in form used to hard-code these, which meant the public sign-in
 * page shipped a working email and password for an account that also existed
 * in production - anyone who loaded the page could press Sign in.
 *
 * Two conditions now have to hold, and the environment check is the one that
 * matters: setting the variables in production by mistake still prefills
 * nothing. A convenience that can only be switched on, and never off, is the
 * shape of the original bug.
 */
export function demoCredentials(
  // Deliberately looser than NodeJS.ProcessEnv, which demands NODE_ENV and
  // makes every test case construct one. process.env still satisfies this.
  env: Record<string, string | undefined> = process.env,
): DemoCredentials | null {
  if (env.NODE_ENV === "production") return null;

  const email = env.DEMO_SIGN_IN_EMAIL?.trim();
  const password = env.DEMO_SIGN_IN_PASSWORD?.trim();
  if (!email || !password) return null;

  return { email, password };
}
