import { redirect } from "next/navigation";

// Creating a project happens in a modal now. This route stays so existing
// links, bookmarks and the mobile "New" tab keep working - the projects page
// opens the modal when it sees ?new=1.
export default function NewProjectPage() {
  redirect("/projects?new=1");
}
