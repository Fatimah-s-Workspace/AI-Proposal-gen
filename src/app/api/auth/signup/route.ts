import { hash } from "bcryptjs";
import { prisma } from "@/server/db";
import { signUpSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        companyName: parsed.data.companyName,
        country: parsed.data.country,
        email,
        hashedPassword,
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

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    return Response.json(
      {
        message: error instanceof Error ? error.message : "Unknown error",
        error,
      },
      { status: 500 },
    );
  }
}
