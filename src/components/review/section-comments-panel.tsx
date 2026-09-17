"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/textarea";

type Person = { id: string; name: string | null; email: string } | null;

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  resolvedAt: string | null;
  author: Person;
  resolvedBy: Person;
};

type Thread = { comment: Comment; replies: Comment[] };

function displayName(person: Person) {
  if (!person) return "Someone no longer in this workspace";
  return person.name ?? person.email;
}

function when(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * The review conversation for one section.
 *
 * Mount with `key={sectionId}`: which thread is being replied to is a fact
 * about one section, and remounting is how that is reset.
 */
export function SectionCommentsPanel({
  sectionId,
  currentUserId,
}: {
  sectionId: string;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["section-comments", sectionId];

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const { data: threads = [], isPending, isError } = useQuery<Thread[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/proposal-sections/${sectionId}/comments`);
      if (!response.ok) throw new Error("Could not load comments");
      const payload = await response.json();
      return (payload.threads ?? []) as Thread[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const post = useMutation({
    mutationFn: async (input: { body: string; parentId?: string | null }) => {
      const response = await fetch(`/api/proposal-sections/${sectionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Could not post this comment");
      return response.json();
    },
    onSuccess: () => {
      setDraft("");
      setReplyDraft("");
      setReplyTo(null);
      void refresh();
    },
  });

  const setResolved = useMutation({
    mutationFn: async (input: { commentId: string; resolved: boolean }) => {
      const response = await fetch(
        `/api/proposal-sections/${sectionId}/comments/${input.commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved: input.resolved }),
        },
      );
      if (!response.ok) throw new Error("Could not update this thread");
      return response.json();
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(
        `/api/proposal-sections/${sectionId}/comments/${commentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Could not delete this comment");
      return response.json();
    },
    onSuccess: refresh,
  });

  const open = threads.filter((thread) => !thread.comment.resolvedAt);
  const resolved = threads.filter((thread) => thread.comment.resolvedAt);

  function renderComment(comment: Comment, isRoot: boolean) {
    return (
      <div key={comment.id} className={isRoot ? "" : "border-l pl-3"}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium">{displayName(comment.author)}</p>
          <span className="text-muted-foreground text-[10px]">{when(comment.createdAt)}</span>
        </div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
        {comment.author?.id === currentUserId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-1.5 text-[10px]"
            disabled={remove.isPending}
            onClick={() => remove.mutate(comment.id)}
          >
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) post.mutate({ body: draft });
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Leave a note for whoever reviews this section"
          maxLength={4000}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!draft.trim() || post.isPending}>
            {post.isPending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>

      {post.isError ? <Feedback tone="error">Could not post that comment.</Feedback> : null}

      {isPending ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3 animate-spin" />
          Loading the conversation…
        </p>
      ) : isError ? (
        <Feedback tone="error">Could not load comments for this section.</Feedback>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border bg-muted p-3 text-xs">
          <p className="text-muted-foreground">
            No comments on this section. Notes left here stay with the bid, so
            the reason a section says what it says is still here next week.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {open.map((thread) => (
            <div key={thread.comment.id} className="space-y-2 rounded-lg border p-3">
              {renderComment(thread.comment, true)}
              {thread.replies.map((reply) => renderComment(reply, false))}

              {replyTo === thread.comment.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (replyDraft.trim()) {
                      post.mutate({ body: replyDraft, parentId: thread.comment.id });
                    }
                  }}
                >
                  <Textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    rows={2}
                    placeholder="Reply"
                    maxLength={4000}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={!replyDraft.trim() || post.isPending}>
                      Reply
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setReplyTo(thread.comment.id);
                      setReplyDraft("");
                    }}
                  >
                    <MessageSquare className="mr-1 size-3" />
                    Reply
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={setResolved.isPending}
                    onClick={() =>
                      setResolved.mutate({ commentId: thread.comment.id, resolved: true })
                    }
                  >
                    <Check className="mr-1 size-3" />
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}

          {resolved.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-muted-foreground text-xs font-medium">
                Resolved ({resolved.length})
              </h4>
              {resolved.map((thread) => (
                <div
                  key={thread.comment.id}
                  className="space-y-2 rounded-lg border border-dashed p-3 opacity-70"
                >
                  {renderComment(thread.comment, true)}
                  {thread.replies.map((reply) => renderComment(reply, false))}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      Resolved by {displayName(thread.comment.resolvedBy)}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={setResolved.isPending}
                      onClick={() =>
                        setResolved.mutate({ commentId: thread.comment.id, resolved: false })
                      }
                    >
                      <RotateCcw className="mr-1 size-3" />
                      Reopen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
