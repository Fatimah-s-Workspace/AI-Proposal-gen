import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db";
import { PRO_PLAN, STARTER_PLAN } from "@/lib/payments/plans";

type UserWithSubscription = Awaited<ReturnType<typeof fetchUser>>;

function fetchUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { subscription: true },
  });
}

// There's no recurring billing/webhook for renewals yet - a pro
// subscription just has a fixed renewsAt from the payment that activated
// it. Rather than a cron job, expiry is checked lazily here: the very next
// time the user's data is loaded after renewsAt has passed, revert them to
// the starter plan. This only ever writes when a pro subscription has
// actually expired, so it doesn't add a DB write to every normal request.
async function downgradeIfExpired(user: UserWithSubscription): Promise<UserWithSubscription> {
  const sub = user?.subscription;
  if (!sub || sub.plan !== PRO_PLAN.id || !sub.renewsAt || sub.renewsAt > new Date()) {
    return user;
  }

  const subscription = await prisma.subscription.update({
    where: { userId: user!.id },
    data: {
      plan: STARTER_PLAN.id,
      status: "trialing",
      renewsAt: null,
      monthlyUploadLimit: STARTER_PLAN.monthlyUploadLimit,
      monthlyProposalLimit: STARTER_PLAN.monthlyProposalLimit,
    },
  });

  return { ...user!, subscription };
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await fetchUser(session.user.id);
  if (!user) return null;
  return downgradeIfExpired(user);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  return user;
}

export async function requireApiUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await fetchUser(session.user.id);
  if (!user) return null;
  return downgradeIfExpired(user);
}
