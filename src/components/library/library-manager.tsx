"use client";

import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";

export type LibraryEntryView = {
  id: string;
  title: string;
  content: string;
  sectionType: string | null;
  tags: string[];
  timesUsed: number;
  lastUsedAt: string | null;
  archivedAt: string | null;
  authorName: string | null;
};

const SECTION_TYPES = [
  { value: "", label: "Any section" },
  { value: "executive_summary", label: "Executive summary" },
  { value: "company_profile", label: "Company profile" },
  { value: "methodology", label: "Methodology" },
  { value: "technical_approach", label: "Technical approach" },
  { value: "risk_management", label: "Risk management" },
  { value: "implementation_plan", label: "Implementation plan" },
  { value: "experience", label: "Experience" },
  { value: "conclusion", label: "Conclusion" },
];

function sectionLabel(value: string | null) {
  if (!value) return "Any section";
  return (
    SECTION_TYPES.find((type) => type.value === value)?.label ??
    value.replace(/[-_]/g, " ")
  );
}

type DraftState = {
  id: string | null;
  title: string;
  content: string;
  sectionType: string;
  tags: string;
};

const EMPTY_DRAFT: DraftState = {
  id: null,
  title: "",
  content: "",
  sectionType: "",
  tags: "",
};

export function LibraryManager({
  entries,
  canDelete,
}: {
  entries: LibraryEntryView[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryEntryView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!showArchived && entry.archivedAt) return false;
      if (!term) return true;
      return (
        entry.title.toLowerCase().includes(term) ||
        entry.content.toLowerCase().includes(term) ||
        entry.tags.some((tag) => tag.includes(term))
      );
    });
  }, [entries, search, showArchived]);

  const archivedCount = entries.filter((entry) => entry.archivedAt).length;

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const tags = draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const body = {
      title: draft.title,
      content: draft.content,
      sectionType: draft.sectionType || null,
      tags,
    };

    try {
      const response = await fetch(
        draft.id ? `/api/content-library/${draft.id}` : "/api/content-library",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Could not save this entry.");
        return;
      }

      if (payload.duplicate) {
        setNotice("This exact text is already in your library, so nothing was added.");
      }
      setDraft(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(entry: LibraryEntryView, archived: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/content-library/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!response.ok) {
        setError("Could not update this entry.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/content-library/${pendingDelete.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Could not delete this entry.");
        return;
      }
      setPendingDelete(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {notice ? <Feedback tone="info">{notice}</Feedback> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search saved answers"
            className="pl-9"
            aria-label="Search saved answers"
          />
        </div>

        {archivedCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </Button>
        ) : null}

        <Button type="button" size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          <Plus className="mr-1.5 h-4 w-4" />
          New entry
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {search.trim()
            ? "No saved answer matches that search."
            : "No saved answers yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((entry) => (
            <li
              key={entry.id}
              className={`rounded-lg border p-4 ${entry.archivedAt ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{entry.title}</h3>
                    <Badge variant="secondary">{sectionLabel(entry.sectionType)}</Badge>
                    {entry.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <p className="text-muted-foreground mt-1.5 line-clamp-3 text-sm whitespace-pre-wrap">
                    {entry.content}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {entry.timesUsed === 0
                      ? "Not used in a bid yet"
                      : `Used in ${entry.timesUsed} ${entry.timesUsed === 1 ? "draft" : "drafts"}`}
                    {entry.authorName ? ` · saved by ${entry.authorName}` : ""}
                  </p>
                  {entry.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      setDraft({
                        id: entry.id,
                        title: entry.title,
                        content: entry.content,
                        sectionType: entry.sectionType ?? "",
                        tags: entry.tags.join(", "),
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit {entry.title}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setArchived(entry, !entry.archivedAt)}
                  >
                    {entry.archivedAt ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {entry.archivedAt ? "Restore" : "Archive"} {entry.title}
                    </span>
                  </Button>

                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPendingDelete(entry)}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                      <span className="sr-only">Delete {entry.title}</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit saved answer" : "New saved answer"}
        description="Give it a title you would recognise on another bid. The title and tags are what suggestions match on."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="library-title">Title</Label>
            <Input
              id="library-title"
              value={draft?.title ?? ""}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, title: event.target.value } : current))
              }
              placeholder="ISO 27001 certification statement"
              required
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="library-section-type">Best suited to</Label>
            <select
              id="library-section-type"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={draft?.sectionType ?? ""}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, sectionType: event.target.value } : current,
                )
              }
            >
              {SECTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Filing an answer under a section makes it more likely to be
              suggested there, and less likely elsewhere.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="library-tags">Tags</Label>
            <Input
              id="library-tags"
              value={draft?.tags ?? ""}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, tags: event.target.value } : current))
              }
              placeholder="security, certification, iso"
            />
            <p className="text-muted-foreground text-xs">
              Separated by commas. Tags are matched against tender wording, so
              use the words a tender would use.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="library-content">Answer</Label>
            <Textarea
              id="library-content"
              value={draft?.content ?? ""}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, content: event.target.value } : current))
              }
              rows={10}
              required
              maxLength={20000}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void remove()}
        title="Delete this saved answer?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" will be removed for everyone in this workspace. Drafts already written from it keep their text. If you only want it to stop being suggested, archive it instead.`
            : ""
        }
        confirmDisabled={busy}
      />
    </div>
  );
}
