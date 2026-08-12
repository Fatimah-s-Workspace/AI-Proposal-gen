import { requireApiUser, listUserOrganizations } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // The workspace switcher refetches on mount and on every ORGANIZATIONS_CHANGED
  // event, so this is deliberately loose - it guards against a script, not a
  // user clicking around.
  const limit = await rateLimit(`org:list:${user.id}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const organizations = await listUserOrganizations(user.id);

  return Response.json({
    organizations,
    activeOrganizationId: user.organizationId,
  });
}
