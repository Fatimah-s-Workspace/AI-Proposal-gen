import assert from "node:assert/strict";
import test from "node:test";

import { containment, tokenize } from "@/lib/text-overlap";

import {
  describeMatch,
  matchLibraryEntries,
  type LibraryCandidate,
} from "./matching";

function entry(overrides: Partial<LibraryCandidate> & { id: string }): LibraryCandidate {
  return {
    title: "Untitled",
    content: "",
    sectionType: null,
    tags: [],
    ...overrides,
  };
}

test("tokenize drops filler that every tender contains", () => {
  const tokens = tokenize("We will provide the project requirements for this tender");
  assert.deepEqual(tokens, [], "every entry contains these, so they cannot distinguish any of them");
});

test("tokenize keeps short codes that contain digits", () => {
  const tokens = tokenize("ISO 27001 and ISO 9001 certification");
  assert.ok(tokens.includes("iso"), "iso is the most searched term in this domain");
  assert.ok(tokens.includes("27001"));
  assert.ok(tokens.includes("9001"));
});

test("containment measures how much of the need is covered, not similarity", () => {
  const need = new Set(["iso", "27001"]);
  const short = new Set(["iso", "27001"]);
  const long = new Set(["iso", "27001", "audited", "annually", "renewed", "scope"]);

  // A thorough answer must not score worse for being thorough.
  assert.equal(containment(need, short), 1);
  assert.equal(containment(need, long), 1);
  assert.equal(containment(need, new Set(["iso"])), 0.5);
  assert.equal(containment(new Set(), long), 0);
});

test("finds the entry that shares distinctive terms", () => {
  const entries = [
    entry({ id: "a", title: "ISO 27001 certification statement", content: "Our ISMS is certified to ISO 27001." }),
    entry({ id: "b", title: "Fleet maintenance schedule", content: "Vehicles are serviced quarterly." }),
  ];

  const matches = matchLibraryEntries(entries, {
    title: "Information security",
    requirements: [{ title: "ISO 27001 certification", description: "Provide evidence of ISO 27001." }],
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].entry.id, "a");
  assert.ok(matches[0].sharedTerms.includes("27001"));
});

test("an entry filed under a different section type is held back", () => {
  const shared = { content: "Our team holds current certifications and insurance.", tags: ["certification"] };
  const entries = [
    entry({ id: "same", title: "Certifications held", sectionType: "company-profile", ...shared }),
    entry({ id: "other", title: "Certifications held", sectionType: "risk-management", ...shared }),
  ];

  const ranked = matchLibraryEntries(
    entries,
    { title: "Certifications held", sectionType: "company_profile" },
    { limit: 2 },
  );
  assert.equal(ranked[0].entry.id, "same", "the deliberately filed entry wins");
  assert.ok(
    ranked[0].score > (ranked[1]?.score ?? 0),
    "a conflicting section type must cost the entry, not be ignored",
  );
});

test("section type is normalised across underscore and hyphen spellings", () => {
  const entries = [entry({ id: "a", title: "Approach", sectionType: "technical_approach", content: "x" })];
  const matches = matchLibraryEntries(entries, { title: "Approach", sectionType: "technical-approach" });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].sectionTypeMatched, true);
});

test("matching section type does not rescue an entry with nothing in common", () => {
  // The bug this exists to prevent: a marine insurance requirement was
  // answered with a health and safety policy, because both were filed under
  // risk-management and the type bonus alone cleared the threshold.
  const entries = [
    entry({
      id: "hse",
      title: "Health and safety policy summary",
      sectionType: "risk-management",
      tags: ["hse", "safety"],
      content: "All field staff hold current HSE Level 3 certification and we record zero lost-time incidents.",
    }),
  ];

  const matches = matchLibraryEntries(entries, {
    title: "Marine vessel insurance cover",
    sectionType: "risk-management",
    requirements: [{ title: "Hull and machinery insurance", description: "Evidence of marine hull insurance to USD 5m." }],
  });

  assert.deepEqual(matches, [], "filing is a hint about relevance, not a substitute for it");
});

test("a section made only of filler words suggests nothing", () => {
  const entries = [
    entry({ id: "a", title: "Anything at all", content: "Lots of words here about everything." }),
  ];
  const matches = matchLibraryEntries(entries, { title: "The project proposal section" });
  assert.deepEqual(matches, [], "suggesting the whole library is worse than suggesting nothing");
});

test("an empty library returns nothing rather than throwing", () => {
  assert.deepEqual(matchLibraryEntries([], { title: "Executive summary" }), []);
});

test("a long unrelated answer does not match by sheer size", () => {
  const filler = Array.from({ length: 400 }, (_, index) => `paragraph${index} delivery schedule logistics`).join(" ");
  const entries = [entry({ id: "big", title: "Logistics plan", content: filler })];

  const matches = matchLibraryEntries(entries, {
    title: "Data protection",
    requirements: [{ title: "NDPR compliance", description: "Describe your NDPR compliance." }],
  });

  assert.deepEqual(matches, []);
});

test("results are capped and ordered deterministically", () => {
  const entries = Array.from({ length: 8 }, (_, index) =>
    entry({
      id: `e${index}`,
      title: "NDPR compliance statement",
      content: "We comply with the NDPR and appoint a data protection officer.",
    }),
  );

  const first = matchLibraryEntries(entries, { title: "NDPR compliance" }, { limit: 3 });
  const second = matchLibraryEntries([...entries].reverse(), { title: "NDPR compliance" }, { limit: 3 });

  assert.equal(first.length, 3);
  assert.deepEqual(
    first.map((match) => match.entry.id),
    second.map((match) => match.entry.id),
    "the same library must rank the same way regardless of input order",
  );
});

test("minScore is honoured", () => {
  const entries = [entry({ id: "a", title: "NDPR compliance", content: "NDPR." })];
  assert.equal(matchLibraryEntries(entries, { title: "NDPR compliance" }).length, 1);
  assert.equal(
    matchLibraryEntries(entries, { title: "NDPR compliance" }, { minScore: 0.99 }).length,
    0,
  );
});

test("describeMatch explains itself in words a bidder can check", () => {
  const [match] = matchLibraryEntries(
    [entry({ id: "a", title: "ISO 27001 statement", sectionType: "company-profile", content: "ISO 27001 certified." })],
    { title: "ISO 27001 evidence", sectionType: "company-profile" },
  );
  const description = describeMatch(match);
  assert.match(description, /same section type/);
  assert.match(description, /27001/);
});

// The bug this exists to prevent: requirements were pooled into one token set,
// so the score was divided by the size of the whole tender. Three requirements
// was already enough to push every entry under the threshold, which would have
// shipped a library that never suggested anything on a real bid.
test("a matching answer survives however many other requirements the tender has", () => {
  const entries = [
    entry({
      id: "iso",
      title: "ISO 27001 certification statement",
      sectionType: "company-profile",
      tags: ["security", "certification"],
      content: "Our ISMS has been certified to ISO 27001:2022, certificate number IS 712345.",
    }),
  ];

  const answered = {
    title: "ISO 27001 certification",
    description: "Bidder must hold current ISO 27001 certification.",
  };
  const unrelated = Array.from({ length: 59 }, (_, index) => ({
    title: `Requirement ${index + 1}: delivery obligation`,
    description:
      "The contractor shall furnish schedules, maintain records, attend site meetings and submit monthly reports to the engineer for approval.",
  }));

  for (const count of [1, 3, 10, 30, 60]) {
    const matches = matchLibraryEntries(entries, {
      title: "Information security",
      sectionType: "company-profile",
      requirements: [answered, ...unrelated.slice(0, count - 1)],
    });

    assert.equal(
      matches.length,
      1,
      `the answer disappeared once the tender had ${count} requirements`,
    );
  }
});

test("a long requirement description does not dilute its own title", () => {
  const entries = [
    entry({
      id: "tax",
      title: "Tax clearance certificates",
      content: "Tax clearance certificates for the last three assessment years are attached.",
    }),
  ];

  const matches = matchLibraryEntries(entries, {
    title: "Statutory compliance",
    requirements: [
      {
        title: "Tax clearance certificates",
        description:
          "The bidder shall submit, in a separate sealed envelope clearly marked and delivered to the address given in the invitation, together with all other statutory documentation required under the procurement act and any subsequent amendments thereto, evidence of its standing.",
      },
    ],
  });

  assert.equal(matches.length, 1, "the discriminating title must still be scored on its own");
});

test("strong matches keep their order instead of tying at the top", () => {
  const entries = [
    // Deliberately alphabetically first, but the weaker answer.
    entry({
      id: "a-weaker",
      title: "Certification overview",
      sectionType: "company-profile",
      content: "We hold a number of certifications relevant to information security.",
    }),
    entry({
      id: "z-stronger",
      title: "ISO 27001 certification statement",
      sectionType: "company-profile",
      tags: ["iso", "27001", "certification"],
      content: "Certified to ISO 27001:2022, certificate number IS 712345.",
    }),
  ];

  const matches = matchLibraryEntries(
    entries,
    {
      title: "ISO 27001 certification",
      sectionType: "company-profile",
      requirements: [{ title: "ISO 27001 certification", description: "Hold current ISO 27001." }],
    },
    { limit: 2 },
  );

  assert.equal(matches.length, 2);
  assert.equal(
    matches[0].entry.id,
    "z-stronger",
    "the better answer must outrank the alphabetically earlier one",
  );
  assert.ok(matches[0].score > matches[1].score);
});
