import { requireApiUser, listUserOrganizations } from "@/server/session";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const organizations = await listUserOrganizations(user.id);

  return Response.json({
    organizations,
    activeOrganizationId: user.organizationId,
  });
}
