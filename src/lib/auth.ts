import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/server/db";
import { signInSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import type { AuthOptions } from "next-auth";

// Shown to the user rather than "invalid email or password", because being
// told to wait is actionable and being told the password is wrong - when it
// may well be right - is not.
export const TOO_MANY_SIGN_IN_ATTEMPTS =
  "Too many sign-in attempts. Please wait a minute and try again.";

export const authOptions: AuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
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

        // Still runs a comparison when the account doesn't exist, so the
        // response time doesn't reveal which emails are registered.
        const hash =
          user?.hashedPassword ??
          "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
        const valid = await compare(parsed.data.password, hash);
        if (!user?.hashedPassword || !valid) return null;

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
