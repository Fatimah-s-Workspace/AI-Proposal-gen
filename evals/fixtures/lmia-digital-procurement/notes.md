# LMIA Digital Procurement & Fleet Tracking System

Tender reference `LMIA/ICT/2026/041`. A three-page RFP, cleanly sectioned, no
tables that survive text extraction. Deliberately the easiest document in the
set — if an extractor cannot score well here it will not score anywhere.

**23 requirements labelled. 12 items deliberately excluded.**

## The labelling rule

A requirement is **something the bidder must do or supply for the bid to be
compliant**. The test applied to every candidate line was: *if this is missing
or wrong, can the bid be rejected?*

That rule is narrower than "every directive sentence in the document", and it
is the single decision that shapes this whole fixture. It follows from what the
product is for — TenderFlow builds a compliance checklist, and the job of a
compliance checklist is to stop you being disqualified.

## What was excluded, and why

**Scope of work (section 5).** Seven bullets describing what the winning bidder
builds — the procurement portal, fleet dashboards, RBAC, training. These are
post-award deliverables. A proposal that ignores them is *weak*, not
*non-compliant*. Excluded.

This is the most arguable call in the fixture. A reasonable reviewer could
include them on the grounds that the technical proposal has to demonstrate
capability against each. If a future version of the product treats the checklist
as "everything the proposal should address" rather than "everything that could
disqualify us", these should be relabelled as `technical` and the baseline
regenerated.

**Evaluation criteria (sections 10–13).** Weightings describing how the buyer
scores bids. Information the bidder should act on strategically, but not an
obligation. Excluded.

**Terms & Conditions (section 16).** Four bullets, all rights LMIA reserves for
itself — reject submissions, cancel the process, request more documents,
negotiate. Obligations on the buyer, not the bidder. Excluded, and worth
watching: these read as directives and are a likely false-positive source for
any keyword-driven extractor.

## Judgement calls inside the included set

- **`tech-security`** is categorised `legal` rather than `technical`. "Data
  Security and Compliance Measures" is driven by regulation; the compliance
  burden is legal even though the work is technical. Debatable.
- **`audited-financials`** is `financial`, not `mandatory`, even though it sits
  in the Mandatory Eligibility list. Category and priority are orthogonal here:
  the category says what kind of thing it is, `priority: high` carries that it
  is mandatory.
- **Technical proposal contents (section 7)** are labelled individually rather
  than as one "submit a technical proposal" requirement. Seven separate items,
  because a bid team needs to tick them off one at a time.
- **`deadline`** is labelled as a requirement despite being a date in a heading.
  Missing it is the single most complete way to fail, so a checklist that omits
  it is not doing its job.

## Extraction notes

`parseTenderSections` produces 17 sections from 3,308 characters. Two artefacts
worth knowing about when reading results:

- Section 8 ("Financial Proposal") comes out with an **empty body**; its content
  lands in section 9 ("Financial proposals must:"). A heading-driven extractor
  may attribute those four bullets to the wrong parent.
- Section 11 ("Criteria Weight") is also empty, and the weightings are split
  across sections 12 and 13. The `nonRequirements` entry for evaluation criteria
  uses the section 12 text only.
