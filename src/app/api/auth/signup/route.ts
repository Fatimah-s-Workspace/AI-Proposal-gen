import { hash } from "bcryptjs";
import { prisma } from "@/server/db";
import { signUpSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { captureError } from "@/lib/monitoring";
import { sendEmail } from "@/lib/email";
import { duplicateSignupEmail, welcomeEmail } from "@/lib/email/templates";
import { sendEmailVerification } from "@/server/email-verification";
import { slugifyOrganizationName } from "@/lib/utils";
import { BCRYPT_COST } from "@/lib/password-policy";
import { authMessages } from "@/lib/messages";
import { serverError } from "@/server/responses";
import {
  checkPasswordBreached,
  breachedPasswordMessage,
} from "@/server/breached-password";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limit = await rateLimit(`signup:${ip}`, 8, 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid signup details", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Normalised by the schema, so this is already trimmed and lowercased.
    const email = parsed.data.email;

    // Checked before the uniqueness lookup so a weak password is refused on
    // its own terms, rather than the response depending on whether the
    // address happens to be taken.
    const breach = await checkPasswordBreached(parsed.data.password);
    if (breach.status === "breached") {
      return Response.json(
        {
          error: breachedPasswordMessage(breach.count),
          issues: { fieldErrors: { password: [breachedPasswordMessage(breach.count)] } },
        },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    // Hashed before the branch, and in both branches, on purpose.
    //
    // This used to answer 409 "an account already exists", which turned
    // signup into a way to test which addresses are registered - the last
    // enumeration hole in the auth surface after sign-in and password reset
    // were closed. Both paths now return the same body.
    //
    // Returning the same body is not enough on its own: hashing costs about
    // 250ms and everything else here costs single-digit milliseconds, so
    // hashing only when the address is new would rebuild the same oracle out
    // of response time, exactly as the malformed placeholder did at sign-in.
    // The two paths still differ by a couple of inserts, which is noise on a
    // network round trip; the 250ms was not.
    const hashedPassword = await hash(parsed.data.password, BCRYPT_COST);

    // Identical in both branches. Built once so a later edit cannot make one
    // distinguishable from the other.
    const genericResponse = Response.json(
      { ok: true, message: authMessages.signupSubmitted },
      { status: 201 },
    );

    if (existing) {
      // The answer signup can no longer give goes to the one person entitled
      // to it: whoever owns the address.
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const { subject, text, html } = duplicateSignupEmail(
          `${baseUrl}/auth/sign-in`,
          `${baseUrl}/auth/forgot-password`,
        );
        await sendEmail({ to: email, subject, text, html });
      } catch (error) {
        captureError(error, { route: "auth/signup", stage: "duplicate_notice" });
      }

      return genericResponse;
    }

    const orgName = parsed.data.companyName || `${parsed.data.name}'s workspace`;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          companyName: parsed.data.companyName,
          country: parsed.data.country,
          email,
          hashedPassword,
        },
      });

      await tx.organization.create({
        data: {
          name: orgName,
          slug: slugifyOrganizationName(orgName),
          memberships: {
            create: { userId: user.id, role: "owner" },
          },
          subscription: {
            create: {
              plan: "starter",
              status: "trialing",
            },
          },
          usageTracking: {
            create: {
              period: new Date().toISOString().slice(0, 7),
            },
          },
        },
      });
    });

    // The account is committed by this point. Email is a courtesy on top of
    // it, so nothing here is allowed to turn a created account into a failed
    // signup - that leaves the user with an account they were told they
    // don't have, and "email already registered" when they try again.
    // Verification can always be re-sent from the app.
    try {
      const { subject, text, html } = welcomeEmail(parsed.data.name);
      await sendEmail({ to: email, subject, text, html });
      await sendEmailVerification(email);
    } catch (error) {
      captureError(error, { route: "auth/signup", stage: "welcome_email" });
    }

    return genericResponse;
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    captureError(error, { route: "auth/signup" });

    // Deliberately generic. The previous version returned error.message and
    // the error object itself, which hands an attacker database constraint
    // names, file paths and stack details straight from a public endpoint.
    // The detail is in the logs and in Sentry, where it belongs.
    return serverError();
  }
}
