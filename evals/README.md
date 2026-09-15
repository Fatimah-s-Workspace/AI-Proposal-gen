# Evals

Measures how well TenderFlow extracts requirements from a tender document,
against hand-labelled truth.

```bash
npm run eval                       # all fixtures, heuristic extractor
npm run eval -- --fixture=<slug>   # one fixture
npm run eval -- --json             # machine-readable report
```

Every run also writes a timestamped report to `evals/results/`.

These are **measurements, not tests**. They live outside `npm test` on purpose:
a number moving is information, not a build failure. Phase 2 adds a committed
baseline so a *regression* can fail a build; phase 3 adds the Gemini extractor
behind `--extractor=gemini`.

## Why

TenderFlow has two extractors that produce the same `ExtractedRequirement[]`
shape — a 496-line deterministic one in `features/tender-intelligence/pipeline.ts`
and a Gemini one reached through `features/ai/gemini-provider.ts`. They have
never been compared. CI sets `GEMINI_API_KEY: ""`, so every existing test
exercises the heuristic or mock path and no test has ever checked that
extraction is *correct* rather than merely well-formed.

The question this harness exists to answer: **on real tender documents, does
the model find more mandatory requirements than the regex, and at what cost?**

## What is measured

| Metric | Meaning |
| --- | --- |
| `recall` | Of the labelled requirements, how many were found |
| `precision` | Of what was returned, how much is a real requirement |
| `clauseAttribution` | Does the quoted text actually appear in the document |
| `categoryAccuracy` | Agreement on category, over matched pairs |
| `priorityAccuracy` | Agreement on priority, over matched pairs |

**Recall dominates.** A missed mandatory requirement disqualifies a bid; a
spurious one costs a reviewer thirty seconds. Optimising F1 here would be the
tutorial answer and the wrong one.

`clauseAttribution` is the hallucination check and needs no labelling — take
the text a requirement claims to quote and confirm it is in the document. It
matters most for the Gemini extractor, where an invented requirement with a
fabricated citation is the failure mode that would actually hurt a user.

## Matching

Extracted text never equals labelled text character for character, so matching
is fuzzy:

1. Normalise with `buildTextDedupeKey` — the product's own normaliser, reused
   so the eval and the pipeline agree on what "the same text" means.
2. Sørensen–Dice over token sets, tokens longer than two characters.
3. Greedy one-to-one assignment, best pairs first, above `MATCH_THRESHOLD`.

One-to-one assignment matters: without it, a single broad extraction
("submit all mandatory documents") would satisfy every mandatory label at once
and recall would be meaningless.

No embedding model. It would add a dependency, a per-run cost, and a second
thing needing evaluation.

## Fixtures

```
evals/fixtures/<slug>/
  document.pdf     the tender
  expected.json    hand-labelled truth
  notes.md         judgement calls and why
```

`expected.json` carries a `nonRequirements` array alongside `requirements` —
text deliberately *not* counted, with a reason. This makes the boundary
explicit rather than implicit in one labeller's head, and lets the report
separate "extracted something we decided isn't a requirement" from "extracted
nonsense". The two deserve different reactions.

Labelling runs one to two hours per document. That is the real cost of this
project.

## Results

`lmia-digital-procurement`, heuristic extractor, 23 labelled requirements.

| | baseline | after stem inheritance |
| --- | --- | --- |
| recall | 47.8% | **95.7%** |
| precision | 57.9% | **68.8%** |
| clause attribution | 100.0% | 100.0% |
| category accuracy | 81.8% (9/11) | 77.3% (**17**/22) |
| priority accuracy | 72.7% (8/11) | 68.2% (**15**/22) |
| requirements returned | 19 | 32 |
| missed | 12 | **1** |

Recall doubled and precision rose with it, because the stem lines that were
being emitted as requirements ("Bidders must submit the following:") are no
longer emitted at all.

**Read the category and priority percentages carefully.** They are computed over
matched pairs only, so the denominator moved from 11 to 22. The percentage fell
while the number of correctly categorised requirements went from 9 to 17. This
is a good argument for the report carrying counts alongside rates.

Attribution stays at 100% because the heuristic extractor can only ever return
text it found. It is the Gemini run where that number becomes interesting.

### What the fix was

Stem inheritance, in `extractTenderClausesFromSections`. A directive line ending
in a colon is treated as a stem: it is not itself emitted as a requirement, and
the list items beneath it inherit its obligation even though they contain no
directive verb of their own. Section titles count as stems too — the parser
splits "Financial proposals must:" into the title, leaving the bullets it
governs alone in the body.

One trap, caught by the harness on the first run: passing the stem into
`classifyClause` as well dropped category accuracy to 54.5%, because a stem
containing "submit" typed every bullet under it as `submission` — CAC stopped
being `mandatory`, Audited Financial Statements stopped being `financial`. The
stem now feeds risk, confidence and actions but **not** category. The stem says
how binding an item is, not what it is about.

That regression was invisible to the 183 existing unit tests, all of which
passed throughout.

### The remaining miss

One of 23: **"Submit by the tender deadline."** The deadline lives in a section
*title* — `Submission Deadline: 30 June 2026, 5:00 PM WAT` — and clause
extraction only reads section bodies. Missing a deadline is the most complete
way to fail a bid, so this is worth fixing even at one occurrence.

### Remaining false positives

Three, after excluding seven that land on declared `nonRequirements`
(scope-of-work bullets, now captured because "The successful bidder shall:" is
itself a stem — the fix cannot tell a bid obligation from a delivery obligation).
Of the three: two are duplicate evidence labels, one is a mid-sentence fragment.

### The original diagnosis, for the record: stems captured, bullets dropped

The extractor keeps the sentence carrying the directive verb and discards the
list items beneath it that carry the actual obligation. From the run:

```
kept     "Bidders must submit the following:"
kept     "The technical proposal must include:"
kept     "The successful bidder shall:"

dropped  "Company Profile"
dropped  "Technical Team CVs"
dropped  "Proposed Technical Architecture"
dropped  "Risk Mitigation Strategy"
dropped  "Data Security and Compliance Measures"
dropped  "Post-Deployment Support Plan"
dropped  "Be quoted in Nigerian Naira (NGN)"
dropped  "Remain valid for 90 days after submission"
```

Exactly inverted. `directivePattern` is tested against each clause candidate
independently, so a stem passes on `must submit` / `must include` / `shall`
while its bullets — which inherit the obligation but contain no directive verb
of their own — fail. The stems are then also false positives, because "Bidders
must submit the following:" is not itself a requirement.

This one root cause drives most of the 12 misses *and* several of the 5
spurious results, so fixing it should lift recall and precision together.
The fix is stem inheritance: when a clause candidate ends in a colon, treat the
list items that follow as requirements carrying the stem's directive.

Worth checking alongside it — a few bullets that *do* contain pattern keywords
(`Project Implementation Methodology` contains "methodology") were still
dropped, so `shouldBecomeRequirement` and `splitIntoClauseCandidates` need a
look too.

### Secondary: mid-sentence clause splitting

```
"and Financial sections."
"Responses to clarifications shall be"
```

Both are fragments of longer sentences, split mid-clause. They damage precision
and would damage attribution for any extractor quoting them.

## Next

- **Phase 2** — label to ten documents, commit `baseline.json`, gate PRs on
  recall regression.
- **Phase 3** — `--extractor=gemini`, `--compare`, cost and latency per document.
- **Phase 4** — confidence calibration, evidence detection, nightly runs.
