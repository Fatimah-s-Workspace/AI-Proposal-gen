import { redirect } from "next/navigation";

// Editing happens in a modal now. This route stays so existing links and
// bookmarks keep working - the project page opens the modal on ?edit=1.
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}?edit=1`);
}
