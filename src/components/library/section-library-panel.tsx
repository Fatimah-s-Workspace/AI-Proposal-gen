"use client";

import { useQuery } from "@tanstack/react-query";
import { BookMarked, BookPlus, Check, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

type Suggestion = {
  id: string;
  title: string;
  content: string;
  sectionType: string | null;
  tags: string[];
  timesUsed: number;
  score: number;
  reason: string;
};

/**
 * The library as it appears beside a section being written: what is worth
 * reusing here, and a way to put this section's wording back into the library
 * once it is good.
 *
 * Mount this with `key={sectionId}`. Which answers have been inserted is a
 * fact about one section, and remounting is how React resets that - clearing
 * it from inside an effect leaves a render where the previous section's
 * insertions are still showing against this section's suggestions.
 */
export function SectionLibraryPanel({
  projectId,
  sectionId,
  sectionTitle,
  sectionType,
  getSectionText,
  onInsert,
}: {
  projectId: string;
  sectionId: string;
  sectionTitle: string;
  sectionType: string | null;
  getSectionText: () => string;
  onInsert: (content: string) => void;
}) {
  const [inserted, setInserted] = useState<string[]>([]);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const {
    data: suggestions = [],
    isPending: loading,
    isError: error,
    refetch,
  } = useQuery<Suggestion[]>({
    queryKey: ["library-suggestions", projectId, sectionId],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/proposal-sections/${sectionId}/library-suggestions`,
      );
      if (!response.ok) throw new Error("Could not load saved answers.");
      const payload = await response.json();
      return (payload.suggestions ?? []) as Suggestion[];
    },
  });

  async function insert(suggestion: Suggestion) {
    onInsert(suggestion.content);
    setInserted((current) => [...current, suggestion.id]);
    // Counted here, on the insert, rather than when the suggestion was shown.
    // A count inflated by impressions would tell a bidder nothing about which
    // answers are actually earning their place.
    try {
      await fetch(`/api/content-library/${suggestion.id}/use`, { method: "POST" });
    } catch {
      // The text is already in the draft; a missed count is not worth an error.
    }
  }

  async function saveSection() {
    const content = getSectionText().trim();
    if (!content) {
      setSaveResult("There is nothing in this section to save yet.");
      return;
    }

    setSaving(true);
    setSaveResult(null);
    try {
      const response = await fetch("/api/content-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveTitle.trim() || sectionTitle,
          content,
          sectionType,
          tags: saveTags.split(",").map((tag) => tag.trim()).filter(Boolean),
          sourceProjectId: projectId,
          sourceSectionId: sectionId,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveResult(payload.error ?? "Could not save this section.");
        return;
      }

      setSaveResult(
        payload.duplicate
          ? "This exact text was already in your library."
          : "Saved. It will be offered on bids that ask the same thing.",
      );
      setSaveOpen(false);
      void refetch();
    } catch {
      setSaveResult("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <BookMarked className="size-3.5" />
          Saved answers
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setSaveTitle(sectionTitle);
            setSaveResult(null);
            setSaveOpen(true);
          }}
        >
          <BookPlus className="mr-1 size-3.5" />
          Save this section
        </Button>
      </div>

      {saveResult ? (
        <Feedback tone={saveResult.startsWith("Saved") ? "success" : "info"}>
          {saveResult}
        </Feedback>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3 animate-spin" />
          Looking for answers you have already approved…
        </p>
      ) : error ? (
        <Feedback tone="error">Could not load saved answers.</Feedback>
      ) : suggestions.length === 0 ? (
        <div className="rounded-lg border bg-muted p-3 text-xs">
          <p className="text-muted-foreground">
            Nothing in your library answers this section yet. When this draft
            reads well, save it — the next tender that asks the same thing will
            offer it back.
          </p>
          <Link
            href="/library"
            className="text-primary mt-2 inline-block font-medium hover:underline"
          >
            Open the content library
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((suggestion) => {
            const used = inserted.includes(suggestion.id);
            return (
              <li key={suggestion.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{suggestion.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {suggestion.reason}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={used ? "ghost" : "outline"}
                    disabled={used}
                    onClick={() => void insert(suggestion)}
                  >
                    {used ? (
                      <>
                        <Check className="mr-1 size-3" />
                        Inserted
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1 size-3" />
                        Insert
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-muted-foreground mt-2 line-clamp-4 text-xs whitespace-pre-wrap">
                  {suggestion.content}
                </p>

                {suggestion.timesUsed > 0 ? (
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    Used in {suggestion.timesUsed}{" "}
                    {suggestion.timesUsed === 1 ? "draft" : "drafts"}
                  </Badge>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save this section to the library"
        description="It becomes available to everyone in this workspace, on every future bid."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSection();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="save-title">Title</Label>
            <Input
              id="save-title"
              value={saveTitle}
              onChange={(event) => setSaveTitle(event.target.value)}
              placeholder={sectionTitle}
              maxLength={160}
            />
            <p className="text-muted-foreground text-xs">
              What you would search for on another bid. A section title like
              &ldquo;Section 4.2&rdquo; will not find itself again.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="save-tags">Tags</Label>
            <Input
              id="save-tags"
              value={saveTags}
              onChange={(event) => setSaveTags(event.target.value)}
              placeholder="security, certification, iso"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save to library"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
