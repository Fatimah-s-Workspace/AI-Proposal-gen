import { NextRequest, NextResponse } from "next/server";

import { captureError } from "@/lib/monitoring";
import { recordLibraryUsage } from "@/server/content-library";
import { unauthorized } from "@/server/responses";
import { requireApiUser } from "@/server/session";

/**
 * Called when an entry is actually inserted into a draft, not when it is
 * merely suggested - the use count is the only evidence of which saved answers
 * are worth keeping, and counting impressions would flatten it to nothing.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ entryId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { entryId } = await context.params;
    const updated = await recordLibraryUsage({
      organizationId: user.organizationId,
      entryIds: [entryId],
    });

    if (updated === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureError(error, { route: "content-library-use:POST" });
    return NextResponse.json({ error: "Failed to record usage" }, { status: 500 });
  }
}
