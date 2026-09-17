// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "@/server/db";

import { BASE_URL, cleanupUser, getOrganizationFor, signUpAndSignIn } from "./helpers";

function api(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}/api/content-library${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(init.headers ?? {}),
    },
  });
}

test("the content library requires authentication", async () => {
  const listed = await fetch(`${BASE_URL}/api/content-library`);
  assert.equal(listed.status, 401);

  const created = await fetch(`${BASE_URL}/api/content-library`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x", content: "y" }),
  });
  assert.equal(created.status, 401);
});

test("an entry can be saved, listed, edited and archived", async () => {
  const { email, cookie } = await signUpAndSignIn();

  try {
    const created = await api("", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "ISO 27001 certification statement",
        content: "Certified to ISO 27001:2022 by BSI, certificate IS 712345.",
        sectionType: "company_profile",
        tags: ["Security", "security", "  ISO  "],
      }),
    });
    assert.equal(created.status, 201);
    const { entry } = await created.json();
    assert.equal(entry.title, "ISO 27001 certification statement");
    // Tags are lowercased, trimmed and de-duplicated, so the same tag typed
    // two ways does not split a library in half.
    assert.deepEqual(entry.tags, ["security", "iso"]);

    const listed = await api("", cookie);
    assert.equal(listed.status, 200);
    const { entries } = await listed.json();
    assert.equal(entries.length, 1);

    const edited = await api(`/${entry.id}`, cookie, {
      method: "PATCH",
      body: JSON.stringify({ title: "ISO 27001 statement" }),
    });
    assert.equal(edited.status, 200);

    const archived = await api(`/${entry.id}`, cookie, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    assert.equal(archived.status, 200);

    // Archiving takes an entry out of the default list without destroying it.
    const afterArchive = await api("", cookie);
    assert.equal((await afterArchive.json()).entries.length, 0);

    const withArchived = await api("?includeArchived=true", cookie);
    assert.equal((await withArchived.json()).entries.length, 1);
  } finally {
    await cleanupUser(email);
  }
});

test("saving the same text twice leaves one entry and says so", async () => {
  const { email, cookie } = await signUpAndSignIn();

  try {
    const body = JSON.stringify({
      title: "Safety record",
      content: "  Zero lost-time   incidents since 2021.  ",
    });

    const first = await api("", cookie, { method: "POST", body });
    assert.equal(first.status, 201);
    const firstPayload = await first.json();
    assert.equal(firstPayload.duplicate, false);

    // Different whitespace and case, same answer - which is what a second
    // click of "Save to library" actually produces.
    const second = await api("", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Safety record again",
        content: "zero lost-time incidents since 2021.",
      }),
    });
    assert.equal(second.status, 200);
    const secondPayload = await second.json();
    assert.equal(secondPayload.duplicate, true);
    assert.equal(secondPayload.entry.id, firstPayload.entry.id);

    const { entries } = await (await api("", cookie)).json();
    assert.equal(entries.length, 1, "one answer, saved twice, is still one answer");
  } finally {
    await cleanupUser(email);
  }
});

test("one workspace cannot read or edit another's library", async () => {
  const owner = await signUpAndSignIn();
  const stranger = await signUpAndSignIn();

  try {
    const created = await api("", owner.cookie, {
      method: "POST",
      body: JSON.stringify({ title: "Private pricing approach", content: "Our day rate is confidential." }),
    });
    const { entry } = await created.json();

    const read = await api(`/${entry.id}`, stranger.cookie);
    assert.equal(read.status, 404);

    const edited = await api(`/${entry.id}`, stranger.cookie, {
      method: "PATCH",
      body: JSON.stringify({ title: "Mine now" }),
    });
    assert.equal(edited.status, 404);

    const deleted = await api(`/${entry.id}`, stranger.cookie, { method: "DELETE" });
    assert.equal(deleted.status, 404);

    const listed = await (await api("", stranger.cookie)).json();
    assert.equal(listed.entries.length, 0);

    // And the original is untouched.
    const stillThere = await (await api(`/${entry.id}`, owner.cookie)).json();
    assert.equal(stillThere.entry.title, "Private pricing approach");
  } finally {
    await cleanupUser(owner.email);
    await cleanupUser(stranger.email);
  }
});

test("a source project from another workspace is refused", async () => {
  const owner = await signUpAndSignIn();
  const stranger = await signUpAndSignIn();

  try {
    const { organizationId } = await getOrganizationFor(stranger.email);
    const foreignProject = await prisma.project.create({
      data: {
        title: "Someone else's bid",
        clientName: "Their client",
        organizationId,
      },
    });

    const created = await api("", owner.cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Borrowed provenance",
        content: "Text saved against another workspace's project.",
        sourceProjectId: foreignProject.id,
      }),
    });

    assert.equal(created.status, 404, "provenance must not link across workspaces");
  } finally {
    await cleanupUser(owner.email);
    await cleanupUser(stranger.email);
  }
});

test("usage is counted when an entry is used, not when it is shown", async () => {
  const { email, cookie } = await signUpAndSignIn();

  try {
    const created = await api("", cookie, {
      method: "POST",
      body: JSON.stringify({ title: "Reusable answer", content: "Something worth reusing." }),
    });
    const { entry } = await created.json();
    assert.equal(entry.timesUsed, 0);

    const used = await api(`/${entry.id}/use`, cookie, { method: "POST" });
    assert.equal(used.status, 200);

    const after = await (await api(`/${entry.id}`, cookie)).json();
    assert.equal(after.entry.timesUsed, 1);
    assert.ok(after.entry.lastUsedAt, "a used entry records when it was last used");
  } finally {
    await cleanupUser(email);
  }
});

test("saved answers are suggested for a section that needs them", async () => {
  const { email, cookie } = await signUpAndSignIn();

  try {
    const { organizationId } = await getOrganizationFor(email);

    // A realistic pack, not a single requirement. Scoring every requirement
    // as one pooled blob made the score shrink as the tender grew, so a
    // one-requirement fixture passed while real bids got nothing.
    const filler = Array.from({ length: 29 }, (_, index) => ({
      title: `Requirement ${index + 1}: delivery obligation`,
      description:
        "The contractor shall furnish schedules, maintain records, attend site meetings and submit monthly reports to the engineer for approval.",
      priority: "medium",
    }));

    const project = await prisma.project.create({
      data: {
        title: "Ministry of Energy solar tender",
        clientName: "Kano State Ministry of Energy",
        organizationId,
        requirements: {
          create: [
            {
              title: "ISO 27001 certification",
              description: "Bidder must hold current ISO 27001 certification.",
              priority: "high",
            },
            ...filler,
          ],
        },
        proposalSections: {
          create: [
            {
              title: "Information security",
              slug: "information-security",
              sectionType: "company_profile",
              order: 1,
            },
          ],
        },
      },
      include: { proposalSections: true },
    });

    const section = project.proposalSections[0];

    await api("", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "ISO 27001 certification statement",
        content: "Our ISMS is certified to ISO 27001:2022, certificate IS 712345.",
        sectionType: "company_profile",
        tags: ["iso", "security"],
      }),
    });

    await api("", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Fleet maintenance schedule",
        content: "Vehicles are serviced quarterly by an approved workshop.",
        sectionType: "methodology",
      }),
    });

    const response = await fetch(
      `${BASE_URL}/api/projects/${project.id}/proposal-sections/${section.id}/library-suggestions`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(response.status, 200);

    const { suggestions } = await response.json();
    assert.equal(
      suggestions.length,
      1,
      "only the answer that fits is offered, however large the tender is",
    );
    assert.equal(suggestions[0].title, "ISO 27001 certification statement");
    assert.match(suggestions[0].reason, /same section type/);

    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await cleanupUser(email);
  }
});

test("deleting a project keeps the answers saved from it", async () => {
  const { email, cookie } = await signUpAndSignIn();

  try {
    const { organizationId } = await getOrganizationFor(email);
    const project = await prisma.project.create({
      data: { title: "A finished bid", clientName: "A client", organizationId },
    });

    const created = await api("", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Answer worth keeping",
        content: "Wording that took an afternoon to get right.",
        sourceProjectId: project.id,
      }),
    });
    const { entry } = await created.json();

    await prisma.project.delete({ where: { id: project.id } });

    // The approved answer is the asset; the bid it came from is not.
    const after = await (await api(`/${entry.id}`, cookie)).json();
    assert.equal(after.entry.title, "Answer worth keeping");
  } finally {
    await cleanupUser(email);
  }
});
