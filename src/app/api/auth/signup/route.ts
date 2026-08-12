import { hash } from "bcryptjs";
import { prisma } from "@/server/db";
import { signUpSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { captureError } from "@/lib/monitoring";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email/templates";
import { sendEmailVerification } from "@/server/email-verification";
import { slugifyOrganizationName } from "@/lib/utils";

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

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An account already exists for this email." },
        { status: 409 },
      );
    }

    const hashedPassword = await hash(parsed.data.password, 12);
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

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    captureError(error, { route: "auth/signup" });

    return Response.json(
      {
        message: error instanceof Error ? error.message : "Unknown error",
        error,
      },
      { status: 500 },
    );
  }
}
