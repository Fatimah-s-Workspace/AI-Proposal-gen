// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "@/server/db";

import { BASE_URL, cleanupUser, getOrganizationFor, signUpAndSignIn } from "./helpers";

async function makeSection(email: string, status = "drafting") {
  const { organizationId } = await getOrganizationFor(email);
  const project = await prisma.project.create({
    data: {
      title: "Review workflow project",
      clientName: "A buyer",
      organizationId,
      proposalSections: {
        create: [
          {
            title: "Executive summary",
            slug: "executive-summary",
            sectionType: "executive_summary",
            order: 1,
            content: "<p>First draft.</p>",
            status,
          },
        ],
      },
    },
    include: { proposalSections: true },
  });
  return { project, section: project.proposalSections[0] };
}

function comments(sectionId: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}/api/proposal-sections/${sectionId}/comments`, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) },
  });
}

test("comments require authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/proposal-sections/whatever/comments`);
  assert.equal(response.status, 401);
});

test("a comment can be posted, replied to, resolved and reopened", async () => {
  const { email, cookie } = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(email);

    const posted = await comments(section.id, cookie, {
      method: "POST",
      body: JSON.stringify({ body: "The bid security figure here does not match clause 3.2." }),
    });
    assert.equal(posted.status, 201);
    const { comment } = await posted.json();

    const replied = await comments(section.id, cookie, {
      method: "POST",
      body: JSON.stringify({ body: "Fixed - it now reads 2%.", parentId: comment.id }),
    });
    assert.equal(replied.status, 201);

    const listed = await (await comments(section.id, cookie)).json();
    assert.equal(listed.threads.length, 1, "a reply belongs to its thread, not beside it");
    assert.equal(listed.threads[0].replies.length, 1);

    const resolved = await fetch(
      `${BASE_URL}/api/proposal-sections/${section.id}/comments/${comment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ resolved: true }),
      },
    );
    assert.equal(resolved.status, 200);

    const afterResolve = await (await comments(section.id, cookie)).json();
    assert.ok(afterResolve.threads[0].comment.resolvedAt);
    assert.ok(afterResolve.threads[0].comment.resolvedBy, "who resolved it is part of the record");

    const reopened = await fetch(
      `${BASE_URL}/api/proposal-sections/${section.id}/comments/${comment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ resolved: false }),
      },
    );
    assert.equal(reopened.status, 200);

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(email);
  }
});

test("resolving a reply settles the whole thread, not half of it", async () => {
  const { email, cookie } = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(email);

    const { comment: root } = await (
      await comments(section.id, cookie, {
        method: "POST",
        body: JSON.stringify({ body: "Check the pricing schedule." }),
      })
    ).json();

    const { comment: reply } = await (
      await comments(section.id, cookie, {
        method: "POST",
        body: JSON.stringify({ body: "Done.", parentId: root.id }),
      })
    ).json();

    await fetch(`${BASE_URL}/api/proposal-sections/${section.id}/comments/${reply.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ resolved: true }),
    });

    const listed = await (await comments(section.id, cookie)).json();
    assert.ok(
      listed.threads[0].comment.resolvedAt,
      "resolving from a reply resolves the point that was raised",
    );

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(email);
  }
});

test("one workspace cannot read or post comments on another's section", async () => {
  const owner = await signUpAndSignIn();
  const stranger = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(owner.email);

    await comments(section.id, owner.cookie, {
      method: "POST",
      body: JSON.stringify({ body: "Internal pricing note." }),
    });

    const read = await comments(section.id, stranger.cookie);
    assert.equal(read.status, 404);

    const posted = await comments(section.id, stranger.cookie, {
      method: "POST",
      body: JSON.stringify({ body: "Hello" }),
    });
    assert.equal(posted.status, 404);

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(owner.email);
    await cleanupUser(stranger.email);
  }
});

// The bug this workflow is built on top of: the autosave endpoint took a
// status from the request body and defaulted it to "drafting", and the editor
// sends only content. A reviewer's decision was erased by the writer typing.
test("autosaving a section does not erase a reviewer's request for changes", async () => {
  const { email, cookie } = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(email, "needs_work");

    const saved = await fetch(`${BASE_URL}/api/proposal-sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ content: "<p>Second draft, addressing the comment.</p>" }),
    });
    assert.equal(saved.status, 200);

    const after = await prisma.proposalSection.findUniqueOrThrow({
      where: { id: section.id },
    });
    assert.equal(
      after.status,
      "needs_work",
      "the request for changes stands until someone acts on it",
    );
    assert.match(after.content ?? "", /Second draft/);

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(email);
  }
});

// The other half of the same rule: approved text that has been edited is no
// longer the text that was approved, so the badge must stop saying so.
test("editing an approved section returns it to drafting", async () => {
  const { email, cookie } = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(email, "approved");

    await fetch(`${BASE_URL}/api/proposal-sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ content: "<p>Changed after sign-off.</p>" }),
    });

    const after = await prisma.proposalSection.findUniqueOrThrow({
      where: { id: section.id },
    });
    assert.equal(after.status, "drafting");

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(email);
  }
});

test("a review state can be set deliberately through the project route", async () => {
  const { email, cookie } = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(email);

    const response = await fetch(
      `${BASE_URL}/api/projects/${project.id}/proposal-sections/${section.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status: "approved" }),
      },
    );
    assert.equal(response.status, 200);

    const after = await prisma.proposalSection.findUniqueOrThrow({ where: { id: section.id } });
    assert.equal(after.status, "approved");

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(email);
  }
});

test("comments survive the person who wrote them leaving the workspace", async () => {
  const author = await signUpAndSignIn();
  const { email: ownerEmail, cookie: ownerCookie } = await signUpAndSignIn();
  try {
    const { project, section } = await makeSection(ownerEmail);
    const { organizationId } = await getOrganizationFor(ownerEmail);
    const { userId: authorId } = await getOrganizationFor(author.email);

    // Put the author in the owner's workspace so they can comment on it.
    await prisma.membership.create({
      data: { userId: authorId, organizationId, role: "member" },
    });

    await comments(section.id, author.cookie, {
      method: "POST",
      body: JSON.stringify({ body: "Clause 3.2 says 2%, not 5%." }),
    });

    await cleanupUser(author.email);

    const listed = await (await comments(section.id, ownerCookie)).json();
    assert.equal(listed.threads.length, 1, "the reasoning behind a decision outlives the account");
    assert.equal(listed.threads[0].comment.author, null);
    assert.match(listed.threads[0].comment.body, /Clause 3.2/);

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(ownerEmail);
  }
});
