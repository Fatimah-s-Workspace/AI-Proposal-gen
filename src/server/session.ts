import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db";
import { PRO_PLAN, STARTER_PLAN } from "@/lib/payments/plans";

export const ACTIVE_ORG_COOKIE = "tf_active_org";

const membershipInclude = {
  user: true,
  organization: { include: { subscription: true } },
} as const;

// The active organization comes from a cookie the switcher sets, but the
// cookie is only ever a *hint* - it's client-controlled, so the membership
// is re-checked here on every request. An unknown or no-longer-valid id
// (left over after being removed from a team) silently falls back rather
// than erroring, so a stale cookie can never lock someone out or leak
// another org's data.
async function fetchMembership(userId: string) {
  const activeOrgId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;

  if (activeOrgId) {
    const preferred = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: activeOrgId } },
      include: membershipInclude,
    });
    if (preferred) return preferred;
  }

  // No preference yet (or it's stale): the most recently joined membership
  // is the sensible default, so accepting an invite lands you in the team
  // you just joined.
  return prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: membershipInclude,
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

// Every organization the user belongs to, for the switcher. Ordered oldest
// first so their original personal workspace stays at the top rather than
// jumping around as they join teams.
export async function listUserOrganizations(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { id: true, name: true } } },
  });

  return memberships.map((membership) => ({
    organizationId: membership.organizationId,
    name: membership.organization.name,
    role: membership.role,
  }));
}
