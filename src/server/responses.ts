import { genericMessages } from "@/lib/messages";

/**
 * The two failure replies that were genuinely duplicated, in one place.
 *
 * "Unauthorized" was written out at fifty call sites and the same 500 body
 * at eleven more, so neither could be reworded without an equal number of
 * edits, and the API said one thing while the interface - which reads from
 * the message vocabulary - said another.
 *
 * Deliberately only these two. The 403s and 404s across the API carry real
 * information in their wording ("Only owners and admins can delete
 * documents", "Project not found"), and collapsing them into one generic
 * helper would trade something specific for something tidy.
 *
 * The wording matters less than it looks: the client maps status codes to its
 * own copy before showing anything, so these bodies are mostly read by
 * whoever is debugging. That is the argument for making them say something
 * useful rather than a single word.
 */

/** No usable session. The client treats this as "sign in again". */
export function unauthorized() {
  return Response.json({ error: genericMessages.sessionExpired }, { status: 401 });
}

/** Something broke on our side. Detail belongs in the logs, not the reply. */
export function serverError() {
  return Response.json({ error: genericMessages.unexpected }, { status: 500 });
}
