import { SettingsNav } from "@/components/settings/settings-nav";
import { requireUser } from "@/server/session";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="space-y-6 pb-8">
      <div className="pt-5">
        <p className="text-sm font-medium text-primary">{user.organization.name}</p>
        <h1 className="text-3xl font-semibold tracking-normal">Settings</h1>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
