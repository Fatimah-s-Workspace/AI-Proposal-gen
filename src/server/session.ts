import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db";
import { PRO_PLAN, STARTER_PLAN } from "@/lib/payments/plans";

// A user can belong to more than one Organization once they've accepted an
// invite, but there's no org switcher yet - so the most recently joined
// membership is treated as active. This makes "accept an invite" behave the
// way you'd expect (you land in the team you just joined) without a
// switcher existing yet; once one does, this is where an explicit
// active-org preference (e.g. from the session) would be consulted instead.
function fetchMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      organization: { include: { subscription: true } },
    },
  });
}

type Membership = NonNullable<Awaited<ReturnType<typeof fetchMembership>>>;
type Organization = Membership["organization"];

// There's no recurring billing/webhook for renewals yet - a pro
// subscription just has a fixed renewsAt from the payment that activated
// it. Rather than a cron job, expiry is checked lazily here: the very next
// time the org's data is loaded after renewsAt has passed, revert it to
// the starter plan. This only ever writes when a pro subscription has
// actually expired, so it doesn't add a DB write to every normal request.
async function downgradeIfExpired(organization: Organization): Promise<Organization> {
  const sub = organization.subscription;
  if (!sub || sub.plan !== PRO_PLAN.id || !sub.renewsAt || sub.renewsAt > new Date()) {
    return organization;
  }

  const subscription = await prisma.subscription.update({
    where: { organizationId: organization.id },
    data: {
      plan: STARTER_PLAN.id,
      status: "trialing",
      renewsAt: null,
      monthlyUploadLimit: STARTER_PLAN.monthlyUploadLimit,
      monthlyProposalLimit: STARTER_PLAN.monthlyProposalLimit,
    },
  });

  return { ...organization, subscription };
}

// Returns the current User merged with their active Organization context.
// `subscription` stays available at the top level (mirroring the old
// user.subscription shape) so existing call sites reading plan limits don't
// need to change; `organizationId`/`organization`/`organizationRole` are the
// new fields for org-scoped access checks.
async function resolveCurrentUser(userId: string) {
  const membership = await fetchMembership(userId);
  if (!membership) return null;

  const organization = await downgradeIfExpired(membership.organization);

  return {
    ...membership.user,
    organizationId: membership.organizationId,
    organizationRole: membership.role,
    organization,
    subscription: organization.subscription,
  };
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return resolveCurrentUser(session.user.id);
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
  return resolveCurrentUser(session.user.id);
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof resolveCurrentUser>>>;
