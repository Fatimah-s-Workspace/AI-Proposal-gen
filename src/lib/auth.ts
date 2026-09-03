import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/server/db";
import { signInSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { UNKNOWN_ACCOUNT_HASH } from "@/lib/password-policy";
import { requiresVerifiedEmail } from "@/lib/verification-policy";
import { authMessages } from "@/lib/messages";
import type { AuthOptions } from "next-auth";

/**
 * Re-exported from the message vocabulary rather than written out here.
 *
 * These two are thrown from authorize() and travel to the browser as the
 * error text, where the sign-in form compares them to decide what to offer -
 * the unverified case gets a "send a new link" button. Two copies of the same
 * sentence meant that comparison silently never matched, so the button never
 * appeared and the account stayed locked out. One definition, one string.
 */
export const TOO_MANY_SIGN_IN_ATTEMPTS = authMessages.tooManyAttempts;
export const EMAIL_NOT_VERIFIED = authMessages.emailNotVerified;

export const authOptions: AuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    // A stolen token stays useful until it expires, and the default is 30
    // days. Seven is long enough that ordinary use is not interrupted, short
    // enough to bound the damage. updateAge means an active session is
    // refreshed at most daily rather than being rewritten on every request.
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/sign-in",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();

        // Keyed on the account, deliberately not on the IP. A per-IP cap
        // looks like the obvious second layer, but this app's users are
        // largely on Nigerian mobile networks, where carrier-grade NAT puts
        // thousands of unrelated people behind one address - a per-IP lockout
        // would take all of them offline together. Password spraying, the
        // attack a per-IP cap is meant to catch, is already capped at this
        // many attempts against each account it touches.
        //
        // Throws rather than returning null: null is indistinguishable from
        // a wrong password, so a throttled user would keep retrying and keep
        // extending their own lockout.
        const attempts = await rateLimit(`signin:${email}`, 8, 5 * 60_000);
        if (!attempts.allowed) {
          throw new Error(TOO_MANY_SIGN_IN_ATTEMPTS);
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Still runs a real comparison when the account doesn't exist, so the
        // response time doesn't reveal which emails are registered.
        //
        // The placeholder has to be a *valid* bcrypt hash at the *same cost*
        // as the ones signup writes. The previous value was neither: it was a
        // malformed string at a nominal cost of 10, and bcryptjs rejects a
        // malformed hash immediately instead of doing the work. Measured, an
        // unknown address answered in 0ms against 266ms for a real one - a
        // 266ms oracle that made this defence worse than useless, because it
        // read as protection while providing none.
        const hash = user?.hashedPassword ?? UNKNOWN_ACCOUNT_HASH;
        const valid = await compare(parsed.data.password, hash);
        if (!user?.hashedPassword || !valid) return null;

        // Checked only after the password is confirmed correct. Refusing
        // earlier would tell anyone who typed an address whether it is
        // registered and unverified, which is a cleaner enumeration signal
        // than the timing gap this file already works to close.
        //
        // Throws rather than returning null so the reason is actionable:
        // "invalid email or password" would send someone to reset a password
        // that was never the problem.
        if (requiresVerifiedEmail(user)) {
          throw new Error(EMAIL_NOT_VERIFIED);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
