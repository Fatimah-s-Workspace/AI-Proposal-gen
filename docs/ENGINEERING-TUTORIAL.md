# How We Built TenderFlow AI

**A guide anyone can follow — even if you have never written a line of code.**

This explains a real, working piece of software: what it does, how every part
of it works, and why each choice was made instead of the other options. It uses
plain words. Every new term is explained the first time it appears. Nothing is
left out because it seemed too hard — the hard parts just get more explaining.

If you are ten years old, this is written for you. If you are a working
engineer, everything here is still true and precise; it is just kinder about it.

---

## How to read this

There are five parts. You can read them in any order.

| Part | What it covers | In plain words |
|---|---|---|
| **0** | What the thing is | The problem, and the shape of the solution |
| **1** | The app, screen by screen | Every page, what it does, what is happening underneath |
| **2** | Data structures and algorithms | The clever recipes that do the thinking |
| **3** | Backend engineering | The part you never see, doing the work |
| **4** | Frontend engineering | The buttons and screens you touch |
| **5** | Design | Why it looks and reads the way it does |
| **6** | Product management | Why we built *this* and not something else |
| **A** | Every package explained | All 41 libraries, and why each beat its alternatives |
| **B** | What is wrong or unfinished | The honest list |

Two words you will see constantly. Learn them now and the rest is easy:

> **Code** is a list of instructions for a computer, written down.
> **A program** (or **app**) is a big pile of those instructions that does
> something useful.

---

## Part 0 — What the thing actually is

### The problem, told as a story

Imagine a huge competition. A hospital needs someone to supply 10,000 beds, and
whoever wins gets paid a lot of money. To enter, you must send in an
application.

The hospital publishes a **rulebook**. It is 80 pages long. Buried inside are
rules like:

- "You **must** attach your tax certificate."
- "Applications sent after 3pm on Friday will **not** be accepted."
- "You **must** show three similar jobs you have done before."

Here is the cruel part: **if you miss even one rule, they throw your
application in the bin without reading it.** All that work, gone, because of one
sentence on page 61 that nobody noticed.

In real life this rulebook is called a **tender pack**, and this happens to
real companies constantly.

### What our program does about it

TenderFlow AI is a helper that:

1. **Reads the rulebook for you.** You give it the file; it reads all 80 pages.
2. **Finds every rule.** It hunts for the sentences that are actually orders,
   and ignores the waffle.
3. **Turns each rule into a checklist item.** Like a packing list before a trip.
4. **Notices what you have already got.** If you upload your tax certificate,
   it ticks off the rule that asked for a tax certificate.
5. **Helps you write the application**, pointing at each rule as it goes.
6. **Gives you a score** — "you are 72% ready" — so you know if you are safe to
   send it.
7. **Makes the final document** you actually submit.

### The single most important idea in the whole program

Here is the map of what happens when you upload a file. Read it once now; the
rest of this guide is just zooming in on each box.

```
     You upload the rulebook (a PDF)
                │
                ▼
     Is this file safe and real?          ← we check, carefully
                │
                ▼
     Save it somewhere                    ← a cupboard for files
                │
                ▼
     Get the words out of the PDF         ← PDFs are surprisingly hard
                │
                ▼
     Chop the words into sections         ← "Part 1", "Eligibility", etc.
                │
                ▼
        ┌───────────────────────┐
        │  Can we ask the AI?   │
        └───────────────────────┘
           yes │         │ no (or it broke)
               ▼         ▼
        Ask Google's AI   Use our own recipes
               │         │
               └────┬────┘
                    ▼
          A list of rules found
                    ▼
          Turn them into checklist items
                    ▼
          Match your documents to the rules
                    ▼
          Work out a readiness score
                    ▼
          Help you write it, then export it
```

Look at that fork in the middle. That is the most important decision in this
entire program, so let us be clear about why it is there.

**AI is not always available.** Sometimes the AI service is broken. Sometimes it
is too busy. Sometimes we have used up our free allowance for the month.
Sometimes the internet is simply down.

Most programs would just show an error and give up. Ours does not. If the AI
cannot help, the program uses its own set of ordinary recipes — no AI, no
internet — and still gives you a full, usable answer. The AI makes it *better*;
it is not what makes it *work*.

> **The rule to remember:** anything that depends on someone else can fail.
> So always have a plan B — and make plan B good enough to live with.

You will see this same idea four more times in this guide: for storing files,
for counting requests, for checking passwords, and for sending email. It is the
single most useful habit in the whole codebase.

### What the program is made of

- **One program** doing everything. Not lots of little separate programs talking
  to each other. Fewer moving parts, fewer things to break.
- **A database** to remember things. A database is just a very organised set of
  labelled boxes that never forgets what you put in them.
- **Most of the work happens on the server.** More on what that means in Part 3.
- **No waiting queue.** Slow jobs run *after* the page has already replied to
  you, so you are never left staring at a spinner.

---

## Part 1 — The app, screen by screen

This is a walk through every page, in the order a real person meets them. For
each one: what you see, what you do, and what is secretly happening underneath.

Terms you need for this part:

> **A page** is one screen in the app. Its **URL** (or **route**) is the
> address you type — like `/dashboard`.
> **Public** pages can be seen by anyone. **Private** pages check who you are
> first and send strangers away.

### 1.1 `/` — The front door (public)

The first thing a stranger sees. Its only job is to answer "what is this and
should I care?" in about ten seconds.

It has four blocks, in this order, and the order is deliberate:

1. **The promise.** "Turn tender packs into compliant proposal drafts without
   losing the trail of evidence." One sentence saying what you get.
2. **Six features** — Tender intelligence, Compliance checklist, Plain-English
   clauses, AI proposal drafting, Evidence matching, Export-ready output.
3. **How it works**, in four steps: Create a project → Upload the tender pack →
   Review the checklist → Draft and export. This is the whole product in four
   words-and-a-bit, so nobody has to guess.
4. **Who it is for** — SMEs & contractors, NGOs & impact teams, BD &
   procurement teams. People decide "is this for someone like me?" faster than
   they decide "is this good?"

*Underneath:* this page is **pre-rendered**, meaning the server builds the
finished page and sends it. Your browser does almost no work, so it appears
fast even on a slow phone on a slow network — which matters, because most of
the people this is built for are on exactly that.

### 1.2 `/auth/sign-up` — Making an account (public)

A form: full name, country (Nigeria by default), organisation, email, password.

Watch the password box as you type. Underneath it, five little rules light up
green one by one:

- At least 8 characters
- A lowercase letter
- An uppercase letter
- A number
- A symbol

**Why show them live?** Because the alternative is cruel. You type a password,
press the button, and *then* get told it was wrong — and now you have to work
out which of five rules you broke. Showing the rules as you type means you
never fail at all.

There is also a small **eye icon** in the password box. Click it and your
password becomes readable. This exists because a password you cannot see is a
password you can typo, and a typo in a new password locks you out of an account
you just made.

*Underneath, when you press "Create account":*

1. The rules are checked again on the server. (Never trust the browser — see
   Part 3.)
2. Your password is checked against a list of **passwords stolen in real data
   breaches**. If yours is on it, you are asked for a different one.
3. Your account is made, along with your own private workspace.
4. A confirmation email is sent.

You are **not** signed in automatically. You have to confirm your email first.
Part 6 explains why we chose that, and what it costs.

### 1.3 `/auth/sign-in` — Coming back (public)

Email, password, "Sign in". A link to reset a forgotten password.

Three things are happening that you cannot see:

- **Wrong password?** You get: *"That email and password combination doesn't
  match an account."* Notice it does **not** say whether the email exists. That
  is on purpose, and Part 3 explains the attack it prevents.
- **Too many tries?** After 8 wrong attempts on the same account, it stops
  accepting them for a few minutes.
- **Email not confirmed yet?** You get told so — and a button appears offering
  to send you a fresh confirmation link.

### 1.4 `/auth/forgot-password` and `/auth/reset-password`

You type your email. The page says: *"If that address has an account, a reset
link is on its way."*

Read that sentence again. It says **"if"**. It says the same thing whether or
not you actually have an account. A stranger typing in your email learns
nothing at all.

The reset link works once and expires after an hour. When you use it, you pick
a new password — and it goes through exactly the same rules and the same
breached-password check as sign-up, because a reset is the moment people are
most tempted to reuse an old password from somewhere else.

### 1.5 `/auth/verify-email` — Confirming it is you

You land here from the link in your email. It checks the link and stamps your
account as confirmed.

The link is **single-use** and expires after 24 hours. If it has expired, you
are told plainly and offered a new one, rather than being left at a dead end.

### 1.6 `/invite/[token]` — Joining someone else's team

Somebody invited you. This page reads the invite code from the address bar,
shows you which team you have been invited to, and lets you accept.

If you do not have an account yet, it sends you to sign-up **with your email
already filled in**, so you cannot accidentally join with the wrong address.

### 1.7 `/dashboard` — Home base (private)

The first thing you see after signing in. It answers "what is going on?" at a
glance:

- **Four counters** across the top: Active projects, Uploaded documents,
  Requirements tracked, Proposal sections.
- **Recent projects**, or a friendly nudge to make your first one.
- **Plan usage** on the right: which plan you are on, how many document uploads
  and AI generations you have used this month, and how many exports.

*Underneath:* the counters come from the database in one go when the page is
built, not from lots of little requests after it loads. That is why it appears
complete instead of filling in piece by piece.

### 1.8 `/projects` — All your work (private)

Every project, with a compliance percentage next to each. There is a search box
so you can find one by name once you have more than a handful.

**What is a project?** One bid for one contract. It holds the rulebook you
uploaded, the checklist that came out of it, the proposal you are writing, and
every version you exported.

### 1.9 `/projects/new` — Starting a bid (private)

A form describing what you are bidding for: title, client, opportunity type
(Tender, RFP, Grant, EOI, RFQ), sector, country, deadline, budget range.

Then some optional but powerful fields: **evaluation criteria**, **win themes**,
contract duration, and whether there is an **incumbent** (the company doing the
job now).

Those last ones are not decoration. They get fed to the AI when it drafts your
proposal, so it can write toward the things the buyer actually scores you on.
A generic proposal loses to a targeted one.

### 1.10 `/projects/[id]` — One project's home (private)

The hub for a single bid. Shows the project's details, its documents, its
compliance score, and links to everywhere else.

This is also where you **upload the tender pack**. Drag a PDF, DOCX or TXT in.
The moment it lands, the whole pipeline from Part 0 starts running.

You get a reply immediately — the file is saved and accepted — while the slow
reading and analysing carries on in the background. You are not made to wait.

### 1.11 `/projects/[id]/parsed-overview` — What the computer found

The most interesting screen in the app. After the rulebook is analysed, this
shows you the results:

- **Parsed documents** — what was read, and whether it worked.
- **Checklist items** — every rule found, what type it is, and how risky it is.
- **Evidence matches** — which of your uploaded documents seem to satisfy which
  rules.

Each clause comes with a **plain-English explanation**. Instead of *"The Bidder
shall furnish a Bid Security in the sum of 2% of the Bid Price..."*, you get
told what that means and what to do about it.

If a document could not be read, this page says so, in words, with a reason —
usually "this is a scanned picture of text, not text". That is far kinder than
silently showing you an empty checklist.

### 1.12 `/projects/[id]/workspace` — Writing the proposal (private)

The word processor. The left side lists your proposal's sections; the middle is
where you write; the AI tools sit alongside.

You can ask it to **draft against the checklist** — it reads your requirements
and writes sections aimed at them, then tells you which rules each section
covers and which are still missing.

Your edits save as you work, and old versions are kept, so you can go back.

### 1.13 `/projects/[id]/export` — Making the final document

Choose **DOCX** (Word) or **PDF**. The file is built and downloaded.

Every export starts with a **cover sheet**: project title, client, reference
number, date. An evaluator opening your file should know who is bidding, for
what, before reading a single word of prose.

Past exports are listed, so you can always get back the exact file you sent.

### 1.14 `/projects/[id]/edit` — Changing project details

Same form as creating, filled in with what is already there. Boring, and it
should be — the interesting thing is that it reuses the identical form
component, so the two screens can never drift apart.

### 1.15 `/activity` — The history book (private)

Every meaningful action anyone in your team took, in plain sentences:
*"Updated a checklist requirement"*, *"Ran the draft assistant"*, *"Joined the
team"*, *"Upgraded to the Pro plan"*. Filterable.

This matters more than it looks. When several people work on one bid, "who
changed this and when?" is a question that gets asked in a panic the day before
a deadline.

### 1.16 `/usage` — What you have used (private)

Uploads, AI generations, exports, and an estimate of AI **tokens** used. (A
token is roughly a chunk of a word — it is how AI usage is counted and billed.)

Shown honestly as an *estimate*, because it is calculated from document and
draft length rather than measured exactly. Saying "estimated" is more useful
than a precise-looking number that is quietly wrong.

### 1.17 `/settings/*` — Four settings pages

- **General** — rename your workspace, or delete it.
- **Account** — your own name, email, whether it is confirmed, and deleting
  your account.
- **Company** — your company profile: legal name, registration number, founded
  year, team size, capabilities, certifications, past performance. This is fed
  to the AI when drafting, so your proposals talk about *your* company instead
  of a generic one.
- **Team** — invite people by email, set their role (admin or member), remove
  them. Only owners and admins see the controls.

### 1.18 `/billing/success` and `/billing/failed`

Where the payment provider sends you back to after you pay. Success confirms
your upgrade; failure explains what to do next.

### 1.19 `/privacy` and `/terms` (public)

The legal pages. Dull, mandatory, and genuinely required before you can take
money from a business customer.

### The shape of the whole app

```
PUBLIC                          PRIVATE (must be signed in)
──────                          ──────────────────────────
/                               /dashboard
/auth/sign-up                   /projects ──┬── /new
/auth/sign-in                               ├── /[id] ──┬── /parsed-overview
/auth/forgot-password                       │           ├── /workspace
/auth/reset-password                        │           ├── /export
/auth/verify-email                          │           └── /edit
/invite/[token]                 /activity
/privacy  /terms                /usage
                                /settings ──┬── /general
                                            ├── /account
                                            ├── /company
                                            └── /team
                                /billing/success  /billing/failed
```

Everything under PRIVATE checks who you are **on the server**, before the page
is built. Not in the browser. That difference is the whole of Part 3's security
argument, and it is the most common mistake beginners make.

---

## Part 2 — Data structures and algorithms

This is the thinking part. Two words first:

> **A data structure** is a way of arranging information so it is easy to work
> with. A shopping list is a data structure. So is a family tree.
>
> **An algorithm** is a recipe: a fixed set of steps that turns some input into
> some output. Long division is an algorithm. So is "how to tie a shoelace".

Everything in this part lives in two files, and both are **pure** — they take
information in and give an answer back, without touching the internet or the
database. That makes them the easiest part of the program to test, which is not
an accident: it is why they were written that way.

### 2.1 Chopping a document into sections

**The problem.** A PDF gives us one enormous blob of text. We need it split into
sections — "Eligibility", "Submission", "Evaluation" — because a rule means
different things depending on which section it is in.

**The idea.** Walk through the text one line at a time. Decide for each line:
*is this a heading, or is this ordinary text?* If it is a heading, start a new
section. If not, add it to whatever section we are currently in.

**How we spot a heading.** Two clues:

1. It is **short** — under 90 characters. Headings are short; paragraphs are not.
2. It either looks like a title (starts with a capital, maybe numbered like
   "3.1") **or** starts with one of nine words we know show up as headings in
   these documents: *scope, eligibility, submission, evaluation, financial,
   technical, terms, instructions, requirements*.

```
for each line:
    if line is short AND looks like a title:
        finish the current section
        start a new section with this line as its name
    otherwise:
        add this line to the current section
```

**The data structure** is just two things: a box we are currently filling
(`current`), and a shelf of finished boxes (`sections`). One pass through the
text. If the document doubles in length, the work doubles — no worse. That is
what people mean by **O(n)**: "grows in a straight line with the input".

**The bug this design avoids.** What if the document starts with a paragraph
*before* any heading? With a naive version, those lines have no box to go in and
get silently thrown away. So the code creates a box called "Tender overview" to
catch them. Losing the first page of a document, silently, is exactly the kind
of bug that survives for years because nothing ever complains.

**Why not something cleverer?** Real PDF layout tools can look at font sizes and
positions to find headings properly. They are also large, slow, and often fail
on the badly-made PDFs that government offices produce. Our two clues are wrong
sometimes — and being wrong just means a section boundary in an odd place, which
a human can see and ignore. We picked the failure we could live with.

### 2.2 Chopping sections into individual rules

A section is still a wall of text. We need it broken into single rules, because
each rule becomes one checklist item.

**Stage one: split into sentences.** Not on every full stop — that breaks
"Ltd." and "3.1" into pieces. Instead: split at a space only when there is a
full stop *before* it and a capital letter or digit *after* it.

**Stage two: split the monsters.** Legal writing chains several obligations into
one endless sentence:

> "The bidder shall submit a tax certificate; provide audited accounts for
> three years; and attach evidence of similar work."

That is three separate things to do. If any sentence is longer than 420
characters, we split it again — at semicolons, and at commas followed by *and*,
*or*, or *provided*.

That number, 420, and that list of words, are **domain knowledge**: things we
know about how procurement documents are written, written down as instructions.
This is a real and underrated skill. Knowing your subject is worth more than
knowing a clever technique.

Finally, each piece is capped at 900 characters. Always put a limit on things.

### 2.3 Deciding what kind of rule it is

We have a rule. What sort is it? We check it against a list of questions, in
order, and the **first one that matches wins**:

```
Does it mention deadlines, submitting, portals, sealed envelopes?  → submission
Does it mention money, prices, bid security, bank guarantees?      → financial
Does it mention methodology, work plans, scope, personnel?         → technical
Does it mention CAC, tax, PENCOM, registration, eligibility?       → eligibility
Does it mention experience, similar assignments, past performance? → experience
Does it mention conflicts, anti-corruption, fraud, contracts?      → legal
Does it mention evaluation, criteria, scoring?                     → evaluation
None of the above?                                                 → instruction
```

This is called a **decision list**, and it is the simplest classifier there is.
Four things about it are worth learning:

**The order is the actual intelligence.** Whatever is checked first wins. We
check "submission" before "technical" because a deadline hidden inside a
technical section is *still a deadline*, and missing a deadline is fatal.
Reordering these lines changes the program's behaviour more than rewriting any
of them.

**There is always an answer.** The last line catches everything else. No rule
can ever come out unlabelled and vanish.

**You can always explain it.** Ask "why did it call this financial?" and you can
point at the exact line. Try that with a big AI model — you cannot. For
something a person has to trust with their livelihood, explainability is a
feature.

**It deliberately over-worries.** Risk is marked "high" if the text contains
*must, shall, required, mandatory, disqualify* — or if it is one of four
high-stakes types. It flags too much. That is the right way round: a false
"high risk" costs someone five minutes of reading. A false "low risk" can lose
them the contract.

### 2.4 How sure are we? — confidence scoring

Every rule gets a confidence number. Start at 0.58, then add:

| If the rule... | Add |
|---|---|
| contains *must, shall, required, submit, provide, attach, include* | +0.22 |
| mentions deadlines, eligibility, technical, financial, tax, CAC, bid security | +0.12 |
| is longer than 80 characters | +0.06 |

Then cap it at 0.97.

Two deliberate choices. **It never reaches 1.0** — a guessing recipe should
never claim to be certain. **It never starts at 0** — anything that got this far
already matched our "this is an instruction" test, so it has earned a base score.

Later, when a rule becomes a checklist item, its confidence *drops* by 0.03.
Every extra step of reasoning is another chance to be wrong, and the number
should admit that.

### 2.5 Removing duplicates — the fingerprint trick

The same requirement often appears three times in one rulebook, worded slightly
differently. Showing it three times makes the checklist useless.

**The idea:** give every rule a **fingerprint**. If two fingerprints match, it
is the same rule.

Making a fingerprint:

```
"Bid Security: 2% of the Bid Price!"
        │  make it all lowercase
        ▼
"bid security: 2% of the bid price!"
        │  turn every punctuation mark and space run into one space
        ▼
"bid security 2 of the bid price "
        │  trim, then keep only the first 120 characters
        ▼
"bid security 2 of the bid price"          ← the fingerprint
```

Now `"Bid Security — 2 % of the Bid Price"` produces *the same fingerprint*.
Different typing, same rule, caught.

Then we walk the list holding a bag of fingerprints we have already seen:

```
seen = empty bag
for each rule:
    f = fingerprint(rule)
    if f is already in the bag:  throw this rule away
    otherwise:                   keep it, and put f in the bag
```

The bag is a **hash set** — a container that answers "have I seen this before?"
instantly, no matter how many things are in it. That instant answer is why the
whole job takes one pass instead of comparing every rule against every other
rule. For 100 rules that is 100 checks instead of 4,950.

**Why only the first 120 characters?** A trade-off, chosen on purpose. Using the
whole sentence would miss near-duplicates where an addendum restates a rule with
a different ending. Using a short prefix catches those — but occasionally merges
two genuinely different rules that begin the same way. In this domain the same
rule really does get repeated, so we err toward merging.

**The best detail here:** this fingerprint function is *exported and reused*.
It runs both within a single upload **and** against rules already stored from
earlier uploads. If those two used different fingerprinting, uploading the same
file twice would create duplicates that the first upload had carefully removed.
One shared function, one definition of "the same".

### 2.6 Matching your documents to the rules

You have uploaded a tax certificate. Which rules does it satisfy?

**The naive approach** — compare the document's text to the rule's text — works
badly, because they are written in totally different language.

**Our approach: give both sides a common vocabulary.** We keep a small
dictionary of about ten kinds of evidence, each with the words that hint at it:

| Evidence type | Hint words |
|---|---|
| Tax clearance | tax clearance, TIN, FIRS, VAT |
| CAC registration | CAC, corporate affairs, registration |
| Bid security | bid security, bank guarantee, tender security, bond |
| Key personnel CVs | CV, curriculum vitae, key personnel, team lead |
| ...and six more | |

Then, for every rule and every evidence type, we ask **two** questions:

1. Does the **rule** ask for this kind of evidence?
2. Does the **document** look like this kind of evidence?

Only if *both* are yes is it a match. Neither side is ever compared to the other
directly — they are both translated into the same ten-word vocabulary first, and
matched there. That is what makes it survive completely different wording.

**Confidence** is simple: if more than one hint word appears in the document,
0.86; otherwise 0.72. A document mentioning both "tax clearance" *and* "FIRS" is
more likely to really be one than a document that says "VAT" once.

We keep only the single best match per rule — a **greedy** choice, meaning we
take the best-looking option without reconsidering later.

**One lovely detail:** when you re-upload a document, its old match is removed
before the new one is added. So processing the same file five times leaves you
with one match, not five. Doing something twice giving the same result as doing
it once is called **idempotence**, and it prevents an enormous class of bugs.

### 2.7 The readiness score

This is the percentage you see on your dashboard, so it deserves care. It
combines two separate ideas:

**How much does this rule matter?**

| Priority | Weight |
|---|---|
| High | 1.35 |
| Medium | 1.00 |
| Low | 0.75 |

**How done is it?**

| Status | Credit |
|---|---|
| Met | 1.00 |
| Waiver (officially excused) | 0.85 |
| In progress | 0.45 |
| Not started | 0.25 |
| Blocked | 0.00 |

Then:

```
score = (sum of weight × credit)  ÷  (sum of weight)  × 100
```

**A worked example.** Three rules:

| Rule | Priority | Status | Weight | Credit | Weight × Credit |
|---|---|---|---|---|---|
| Tax certificate | High | Met | 1.35 | 1.00 | 1.35 |
| Three references | Medium | In progress | 1.00 | 0.45 | 0.45 |
| Company brochure | Low | Not started | 0.75 | 0.25 | 0.19 |
| | | | **3.10** | | **1.99** |

`1.99 ÷ 3.10 = 0.642` → **64%**.

Three decisions inside that formula are worth understanding:

**We divide by total weight, not by how many rules there are.** That is what
makes 64% mean the same thing on a project with 8 rules and one with 80.

**Blocked scores zero, never negative.** A blocked rule pulls the score down by
removing its own weight from the top of the fraction — but it cannot drag you
below what your other work earned. If it could, doing more work could make your
score go *down*, and users rightly find that maddening.

**A waiver is 0.85, not 1.00.** Officially excused is not the same as done.
There is a little risk left, and the number quietly says so.

### 2.8 The compliance score — three views and a penalty

A second, deeper score used after drafting. It builds three sub-scores:

```
completeness  = (rules covered ÷ total rules) × 100
technical     = 100 − (blocked × 12) − (weak × 4)
documentation = 100 − (blocked × 15) − (weak × 5)
```

Then blends them, with weights adding up to 1.0:

```
overall = completeness×0.55 + technical×0.25 + documentation×0.20 − (blocked × 2)
```

Notice a blocked rule is punished **three times**: once inside `technical`, once
inside `documentation`, and once again at the end. That looks like a mistake. It
is not. A blocked mandatory rule is the single strongest sign that a bid will be
rejected, so the score is built to be dominated by it. Finally everything is
clamped between 0 and 100, which is what stops that aggressive punishment
producing a negative percentage.

### 2.9 The weakest algorithm in the program (and why we say so)

After drafting, we check whether each rule is actually covered. The current
method: take everything written, and ask *does the rule's exact wording appear
inside it?*

- Appears twice (both title and description) → **covered**
- Appears once → **weak**
- Not at all → **missing**, or **blocked** if it was mandatory

**This is not good enough, and it should be said plainly.** It only finds
*exact* copies. If the draft says "we will provide our tax clearance
certificate" but the rule said "furnish evidence of tax compliance", it scores
zero — even though the draft covers it perfectly.

It appears to work because drafts are generated *from* the rules, so the exact
words often survive. But it is measuring **copying**, not **covering**.

**The proper fix** is to compare the *set of words* in each, rather than exact
text — how much do they overlap? Two sentences sharing 80% of their meaningful
words are almost certainly about the same thing, whatever order they are in.

This is in the guide because noticing the limits of your own work is the actual
skill. Anyone can write something that works on the happy path.

### 2.10 Checking the writing quality

Three counters look through the draft for repeated phrases, generic waffle, and
weak statements ("we will try to", "we hope to"). Each has its own penalty:

```
quality = 100 − (repeats × 12) − (generic × 10) − (weak × 8)
```

Honest about its limits: it can only find bad writing it has been told about. It
will never spot a new kind of bad writing. In exchange, it runs in a
thousandth of a second and never invents a problem that is not there.

### 2.11 Clever tricks elsewhere in the program

| Where | The trick | Why it matters |
|---|---|---|
| File upload | **Reading the first 8 bytes** of the file | The name and type of a file are whatever the sender claims. The first few bytes are the file itself telling you what it is. Every real PDF starts `%PDF-`. |
| Request limiting | **Sliding window counting** | Counting per fixed hour lets someone fire everything at 10:59 and again at 11:00. A sliding window looks at "the last 60 seconds" from right now, so there is no seam to exploit. |
| Sign-in | **Always doing the same amount of work** | Explained fully in Part 3 — it is the best story in the whole project. |
| Passwords | **k-anonymity** | Checking your password against 800 million stolen ones *without ever sending your password anywhere*. Also Part 3. |
| Payments | **HMAC signatures** | A way to prove a message really came from who it claims. Without it, anyone finding the address could shout "this person paid!" and get a free upgrade. |
| Reading AI output | **Three rescue attempts** | AI often wraps its answer in chatter. So: try to read it directly; if that fails, look for a fenced code block; if that fails, grab everything between the first `{` and the last `}`. Each attempt is cheap, and they are ordered most-likely-correct first. |

That last one deserves its own mention, because you will need it any time you
work with a system whose output you do not control:

```
Try to read the whole thing as data.        → worked? done.
Look for a ```json block and read that.     → worked? done.
Grab from the first { to the last }.        → worked? done.
Give up and say so clearly.
```

Getting a *slightly* wrong answer from a machine is far more common than getting
a completely wrong one. Plan for slightly wrong.

---

## Part 3 — Backend engineering

> **The backend** is everything that happens on the **server** — a computer
> somewhere else that you never see. The **frontend** is what runs on your own
> phone or laptop. When you press a button, the frontend asks the backend a
> question, and the backend answers.

The backend's job is to be the grown-up: it holds the real data, decides who is
allowed to do what, and never believes anything the browser tells it.

### 3.1 Why never trust the browser

This is the first idea in security, and everything else depends on it.

Anything running on your computer, **you** control. You can open the developer
tools and change it. So if the browser sends the server a message saying "I am
the boss of this workspace, delete everything" — the server must not simply
believe it.

So every private page and every action asks the server: *who is this really, and
are they allowed?* The button being hidden in the interface is a **convenience**,
not a **protection**. The protection is on the server.

### 3.2 The framework: Next.js

> **A framework** is a pre-built skeleton for an app: routing, page building,
> and structure, so you do not write it all yourself.

We use **Next.js**, which lets one project contain both the pages you look at
and the backend that serves them.

**Why Next.js instead of the alternatives?**

| Option | What it means | Why not |
|---|---|---|
| **Next.js** ✅ | Pages and backend in one project | Chosen: one thing to build, deploy, and reason about |
| React on its own | Just the screens | You would still need a whole separate backend |
| Express + React separately | Two projects | Two deployments, two sets of types, constant drift between them |
| Rails / Django | Mature all-in-one frameworks | Excellent — but the team writes TypeScript, and mixing languages doubles what everyone must know |

The deciding factor is real: **one language everywhere**. The same description
of what a "Project" is gets used by the database, the backend, and the screen.
If someone changes it in one place, the others stop compiling immediately —
instead of breaking quietly in front of a customer.

### 3.3 The database: PostgreSQL and Prisma

> **A database** stores information permanently and safely, even if the program
> restarts. **PostgreSQL** is one of the best free ones.

Our database has **25 tables**. A table is like one spreadsheet: `User`,
`Project`, `Requirement`, `TenderClause`, `Payment`, and so on.

**Prisma** sits between our code and the database. You describe your tables once
in a single file, and Prisma:

1. Creates the real tables for you.
2. Generates code so that if you type `project.titel` instead of `project.title`,
   it refuses to build — instead of returning nothing at 2am in production.

**Why Prisma instead of the alternatives?**

| Option | Why not |
|---|---|
| **Prisma** ✅ | Chosen: the safety net is automatic and complete |
| Writing SQL by hand | Total control, zero safety net. One typo in a column name is a runtime bug |
| TypeORM / Sequelize | Older tools; their type safety has real gaps |
| Drizzle | Genuinely good, lighter and closer to SQL. A fair alternative — Prisma won on maturity of its migration tooling |

### 3.4 Migrations, and a real production accident

> **A migration** is a recorded change to the database's shape — "add a column
> called `country`". They are numbered and run in order, so every copy of the
> database ends up identical.

There are 8 of them in this project.

**What went wrong.** One migration, `add_organizations`, ran halfway. It created
some things and then failed. The database was left in a state that matched
neither the "before" nor the "after".

The standard fix is a command that means "mark this as done and move on". **It
would have been the wrong thing to do**, because the migration genuinely had not
finished — every one of its eight connections between tables was missing.
Marking it done would have buried the damage under a clean-looking record.

**The lesson:** when a tool offers you a quick fix for a broken state, first
check *which* broken state you are actually in. The fix that clears the error
message is not always the fix that solves the problem.

### 3.5 Sign-in, and how passwords are really stored

**We never store your password.** Not encrypted, not hidden — not at all.

Instead we store a **hash**: the result of a one-way scrambling recipe.

> Feeding "hello" into a hash always gives the same scrambled result. But there
> is no way to run it backwards and get "hello" back. It is like blending fruit:
> easy one way, impossible to reverse.

When you sign in, we scramble what you typed and compare the two scrambles. If
they match, you knew the password — without us ever having stored it. If our
database is ever stolen, the thief gets scrambles, not passwords.

We use **bcrypt** with a **cost of 12**. The cost controls how slow the
scrambling is: each step up doubles the time. Slowness is the *feature* — it
makes each of an attacker's billions of guesses cost real time. Ours takes about
a quarter of a second.

| Option | Why not |
|---|---|
| **bcrypt** ✅ | Chosen: everywhere, proven since 1999, deliberately slow |
| Plain text | Catastrophic. Never |
| MD5 / SHA-1 | Built to be *fast*, which is exactly wrong here — a modern graphics card guesses billions per second |
| Argon2 / scrypt | Genuinely stronger, and resist specialised hardware better. bcrypt won on how boringly available it is everywhere |

### 3.6 The best story in the project: the timing attack

This is a real security hole that existed in this code, and how it was found.

**The setup.** When you try to sign in, the server looks up your email. If there
is no such account, there is nothing to compare against — so the obvious code
just says "no" immediately.

**The hole.** Watch what an attacker sees:

```
Try alice@example.com  → "no"  after 266 milliseconds
Try zzz@nowhere.com    → "no"  after 0 milliseconds
```

Both say no. But **the first one took a quarter of a second and the second was
instant**. Why? Because for Alice, the server did the slow scrambling work. For
the made-up address, there was nothing to scramble, so it returned instantly.

The attacker has learned that **Alice has an account here** — without ever
guessing her password. Do that with a million email addresses and you have a
list of every customer. That is a genuine privacy breach, and it is often the
first step in a targeted attack.

**The fix** is to always do the same amount of work. When there is no account,
compare against a fake stored scramble anyway, so the slow part happens either
way.

**The twist, and why this story is worth telling.** That fix *was already in the
code*. There was a fake scramble, and a comment explaining it. But it had two
problems:

1. The fake was not a **valid** scramble — just a made-up string of letters. The
   scrambling tool looks at it, sees it is malformed, and rejects it
   *immediately* without doing any work.
2. It was set to cost **10**, while real passwords used cost **12** — four times
   faster even if it had been valid.

So the defence did nothing. Worse than nothing: it *looked* like protection, so
nobody checked it. Measured:

| Situation | Time to say no |
|---|---|
| Real account, wrong password | **266 ms** |
| No such account | **0 ms** |

**The real lesson is not about passwords.** It is this: a comment saying
"this is safe" is not evidence. The hole was found by *measuring*, not by
reading. And the tests written afterwards do not check that the fake scramble
equals some particular text — they check the **properties** that matter: that it
is a valid scramble, and that its cost matches the real one. If someone raises
the cost later and forgets the fake, the tests fail instead of the hole silently
reopening.

### 3.7 Stopping guessing: rate limits

If someone can try a million passwords, a slow hash only helps so much. So after
**8 wrong attempts on one account**, we stop accepting them for a few minutes.

**An interesting decision.** The obvious extra layer is "also block by internet
address". We deliberately do **not**.

Most of this app's users are in Nigeria, on mobile networks. Those networks put
**thousands of unrelated people behind one shared address**. Blocking by address
would kick a whole city off together because one stranger typed a wrong
password. Blocking per account gets the same protection without that.

That is a security decision made by knowing *who the users are*. The textbook
answer would have been actively harmful here.

### 3.8 Checking passwords against real leaks — without sending them

**The problem.** `P@ssw0rd1` passes every rule we have: eight characters,
capital, lowercase, number, symbol. It has also appeared in **253,616** known
data breaches. Rules alone cannot catch it.

There is a public service holding hundreds of millions of leaked passwords. But
sending them your users' passwords would be insane.

**The trick, called k-anonymity.** Instead of asking about *your* password, ask
about a whole *neighbourhood* of passwords.

```
1. Scramble your password           → 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
2. Send only the first 5 characters → "5BAA6"
3. They send back every leaked scramble starting with 5BAA6 — about 500 of them
4. We look through that list ourselves, on our own server
```

They never learn which one you asked about — or whether any of them matched.
Your password never leaves the building.

**And if that service is down?** We let the password through. That is a
deliberate choice: a person who cannot sign up because someone *else's* service
is broken cannot fix it, cannot understand it, and simply leaves. A slightly
weak password getting through is the smaller harm.

> **Fail open or fail closed?** Failing *closed* (blocking when unsure) is right
> for a bank vault. Failing *open* is right for an optional extra check. Knowing
> which you are building is the skill.

### 3.9 Teams and permissions

Every person belongs to one or more **organisations** (workspaces). Every
project belongs to an organisation, not to a person — so when someone leaves,
the work does not leave with them.

Three roles:

| Role | Can do |
|---|---|
| **Owner** | Everything, including billing and deleting the workspace |
| **Admin** | Invite and remove people, delete projects and documents |
| **Member** | Create and edit projects |

Two careful details:

**Admins cannot touch billing.** Deliberately narrower than managing people, so
you can let someone grow the team without giving them the payment method.

**Admins cannot make someone an owner**, or change an existing owner. Handing
over ownership needs a proper flow that does not exist yet — so rather than
half-support it, it is blocked.

### 3.10 Which workspace am I in? — a lesson about trust

The app remembers your current workspace in a **cookie** (a small note the
browser keeps and sends back each time).

But a cookie lives on *your* computer, so **you can change it**. Someone could
edit theirs to another workspace's identifier.

So the cookie is treated as a **hint, never a fact**. Every request the server
re-checks: *is this person actually a member of that workspace?* If not, it
quietly falls back to one they really do belong to. Not an error — a stale
cookie should never lock you out, and it must never let you in.

### 3.11 A scheduled job that is not scheduled

Pro plans last 30 days. Something must notice when one runs out.

The obvious answer is a program that wakes every night and checks everyone.
That is another moving part to run, monitor, and pay for.

Instead: the check happens **the next time that workspace's data is loaded
anyway**. If the expiry date has passed, it downgrades right then. Nobody can
experience an expired-but-still-working plan, because experiencing it requires
loading the data, which triggers the check.

It only writes when a plan has genuinely expired, so it costs nothing the rest
of the time. This is called **lazy evaluation** — do the work at the last useful
moment, not on a schedule.

### 3.12 Payments, and two messages racing

After you pay, we find out in two ways:

1. Your browser is **redirected back** to us.
2. The payment company sends our server a **direct message** (a *webhook*).

Either can arrive first. Either can fail — you might close the tab straight
after paying.

Both go to the same function, which first checks: *is this payment already
marked successful?* If yes, it stops. So whichever arrives first does the work,
and the other one harmlessly does nothing. Same idea as §2.6: **doing it twice
is the same as doing it once.**

Two more safeguards:

**The signature.** The direct message is signed with a secret only we and the
payment company know. Without checking it, anyone who found the address could
send "this person paid!" and get a free upgrade.

**The amount.** We check the amount actually paid matches what we asked for.
Never trust a number that travelled through the customer's browser.

### 3.13 The bug that broke every email for weeks

Every email — welcome, confirm your address, reset password, team invites,
renewal reminders — failed. For weeks. Nobody noticed, because nothing errored
loudly; the emails just never arrived.

The cause was **one letter**:

```
https://api.brevo.com/v3/smtp/emails      ← what we had.  Wrong.
https://api.brevo.com/v3/smtp/email       ← correct.
```

The wrong address returned `404 HTTP route not found` — a *gateway* error, not
an API error, so it carried no hint that the URL was the problem.

**Why this is in the guide:** it was misdiagnosed twice, blamed on a network
restriction, before anyone simply sent the same message to both addresses and
compared. Two minutes of measuring beat two rounds of confident theorising.

### 3.14 Doing slow work without making you wait

Reading an 80-page PDF and analysing it takes a while. If the upload request did
all that before replying, you would stare at a spinner — and the server might
give up and kill the request.

So the upload does the fast part (check the file, save it, record it), replies
immediately, and the slow analysis runs **after the reply has been sent**, using
a built-in feature for exactly this.

No queue system, no extra service. For this size of app, that is the right
trade: fewer moving parts. If it grows, a real queue is the next step.

### 3.15 How we know it works: testing

> **A test** is code that checks other code. You describe what *should* happen;
> the computer verifies it.

Two kinds here:

**Unit tests (183)** check one small piece with no database and no internet. They
run in seconds, so you run them constantly.

**Integration tests (67)** start a real server and a real database, then do what
a person would do: sign up, sign in, upload, export. Slower — about six minutes
— but they catch things unit tests never can.

**A story about why you need both.** After a change, all 183 unit tests passed.
Everything looked fine. Then the integration tests ran: **50 of 65 failed.**

The cause was one thing — a helper that created test accounts used the password
`password123`, which the new rules rejected. One root cause, fifty
different-looking failures.

Worse, the helper that signed in **did not check that it had worked**. It
returned whatever came back, so a refused sign-in showed up much later as a
confusing error from something unrelated. It was fixed to fail loudly and
immediately.

> **The lesson:** a test helper that quietly tolerates failure turns one obvious
> bug into fifty mysterious ones.

---

## Part 4 — Frontend engineering

The frontend is everything you can see and touch. Its job is to make a
complicated thing feel simple.

### 4.1 The single most important frontend idea here

There are two places work can happen: **on the server**, before the page is sent
to you, or **in your browser**, after it arrives.

> Think of a restaurant. Some things happen in the **kitchen** before the plate
> reaches you. Other things happen **at your table** — pouring water, adding
> salt. Both are needed. Doing kitchen work at the table is slow and messy.

In this app, **48 of 94 screen files run in your browser**. The other half run
only on the server. That is a deliberate default: *server unless there is a
reason*.

**Why prefer the server?**

| Server does the work | Browser does the work |
|---|---|
| Page arrives finished | Page arrives empty, then fills in |
| No delay while code downloads | You wait for code, then wait for data |
| Database access is safe here | Secrets would be visible to anyone |
| Works on a slow phone | Struggles on a slow phone |

The last row decided it. Many of this app's users are on mid-range Android
phones on mobile data. Every kilobyte of code is a real wait for them.

Anything **interactive** — a form, a dropdown, the text editor — must run in the
browser, and those files say `"use client"` at the top.

### 4.2 Forms: react-hook-form and Zod

A form seems easy until you list what it must do: remember what you typed,
validate it, show errors next to the right box, disable the button while saving,
and not re-draw the entire screen on every keystroke.

**react-hook-form** handles that. Its trick is that it does **not** re-draw the
page as you type. Typing 40 characters redraws the page 40 times in the naive
approach; this does it approximately never.

**Zod** describes what *valid* means, once:

```
signUpSchema = {
  name:        text, at least 2 characters
  email:       must look like an email
  password:    must pass the password rules
  country:     text, at least 2 characters
}
```

**The valuable part:** that same description is used in the browser **and** on
the server. One definition, two places. They cannot disagree — and the server
one is the one that actually protects you, because the browser can be bypassed.

| Option | Why not |
|---|---|
| **react-hook-form + Zod** ✅ | Chosen: fast, and one shared definition of valid |
| Plain React state | You write all of it yourself, and re-draw constantly |
| Formik | Popular, older, re-draws more |
| Yup | Fine validator, weaker TypeScript support than Zod |

### 4.3 A small bug worth learning from

The password checklist needed to watch what you were typing. The obvious way:

```
form.watch("password")
```

The code checker flagged it. React's newer optimiser cannot safely speed up code
using `watch()`, because it cannot tell when the value really changed.

The fix was one word:

```
useWatch({ control: form.control, name: "password" })
```

Same result, and it subscribes to just that one field. **The lesson:** when a
tool warns you about something that "works fine", it is usually warning about
something that will stop working fine later.

### 4.4 Two kinds of memory

An app remembers two very different things.

**Server state** — things that live in the database: your projects, your
requirements. The browser only ever holds a *copy*, which can go stale.

**Client state** — things that only matter right now, on your screen: which
section is selected, whether a menu is open. Nobody else needs to know.

Beginners store both the same way, and it causes endless bugs. This app uses
different tools for each:

- **TanStack Query** for server state. It fetches, caches, and knows when a copy
  is stale (after 30 seconds, here).
- **Zustand** for client state. About twenty lines to hold "which section is
  selected".

**An honest note:** TanStack Query is used in exactly **one** file. Most pages
load their data on the server instead, which needs no fetching library at all.
It earns its place for the editor and nowhere else. That is worth admitting — a
dependency used once is a dependency worth questioning.

| Option | Why not |
|---|---|
| **Zustand** ✅ | Chosen: tiny, no ceremony |
| Redux | Powerful, lots of boilerplate; far too much for one selected id |
| React Context | Free, but re-draws everything underneath it on every change |

### 4.5 The text editor: TipTap

The proposal editor needs bold, italic, headings, lists — and to give us the
content back as structured data, not a screenshot.

**TipTap** provides that. It is a layer over a serious editing engine
(ProseMirror), which is genuinely hard to use directly.

| Option | Why not |
|---|---|
| **TipTap** ✅ | Chosen: solid foundation, sane API |
| A plain `<textarea>` | No formatting at all |
| `contentEditable` by hand | Famously the worst API in the browser |
| Quill / Draft.js | Older, less actively maintained |

### 4.6 Styling: Tailwind and design tokens

**Tailwind** lets you style by putting small named classes directly on elements:
`className="flex items-center gap-3"` means "lay these out in a row, line them
up, put a gap between them".

It looks cluttered at first. The payoff: you never invent a name for something
you will only use once, and you cannot accidentally break a different page by
editing a shared stylesheet.

**Tokens** are the important half. Colours are never written directly. Instead:

```
--primary: 176 76% 26%      ← in normal mode: a deep teal
--primary: 174 72% 42%      ← in dark mode:   a brighter teal
```

Everything says "use primary". Switching to dark mode changes those definitions
once, and the whole app follows. Nothing anywhere says "teal".

### 4.7 Buttons and dropdowns: Radix

Building a dropdown that fully works is much harder than it looks. It must
handle keyboard arrows, Escape, focus moving correctly, screen readers, and
closing when you click away.

**Radix** provides these **unstyled** — all behaviour, no appearance. We add the
appearance with Tailwind.

| Option | Why not |
|---|---|
| **Radix** ✅ | Chosen: correct behaviour, our own look |
| Build them ourselves | Months of work, and accessibility bugs forever |
| Material UI / Chakra | Complete, but bring their own look you then fight |

### 4.8 One way to tell you something went wrong

Every message the app shows comes from **one file**, written under five rules:

1. **Never leak internal detail.** `CredentialsSignin` is not a sentence.
2. **Never reveal whether an account exists.**
3. **Say what happened and what to do next.**
4. **Do not blame the reader.** No "you entered it wrong". No exclamation marks.
5. **Do not over-apologise** either. One clear sentence.

And one component draws them all, so a failure and a success never look like the
same sentence in different colours. Each carries an **icon as well as a colour**,
because colour alone is not readable by everyone — roughly 1 in 12 men has some
colour blindness.

### 4.9 The bug that hid a fix

The best frontend bug in the project.

The plan: if sign-in fails because your email is unconfirmed, show a button
offering a fresh link. The code did this:

```
if (the error message == "Confirm your email address before signing in...")
    show the button
```

It compared the shown error against the official message. Sensible.

**But the same sentence existed in two files.** One file threw the error; the
other held the text the check compared against. They had drifted apart by a few
words.

So the comparison **never matched**. The button would never have appeared. The
escape hatch for locked-out users existed — and was unreachable.

It was caught by *actually signing up and getting locked out*, and noticing the
message on screen did not match the one in the code.

**Two lessons.** First: never write the same sentence in two places; write it
once and point at it. Second: a feature you have not used yourself is a feature
you have not tested.

### 4.10 No flash of the wrong colour

If you use dark mode, a badly-built app flashes white for a moment before
switching. That flash is the browser drawing the page before the code deciding
your theme has run.

The fix: a tiny script that runs **during** the page's construction, before
anything is drawn, and sets the theme immediately.

That script is a small security problem too — the app's security policy blocks
inline scripts, exactly to stop injected ones. So this one is allowed by its
**fingerprint**: a hash of its exact contents. Change one character and it stops
being allowed. A test checks this, so a silent change breaks the build rather
than the page.

---

## Part 5 — Design

Design is not "making it pretty". It is making it **understandable**. A
beautiful screen nobody can use has failed.

### 5.1 Colour, defined once

Every colour in the app has a name and a job:

| Name | Job | Normal mode | Dark mode |
|---|---|---|---|
| `background` | The page behind everything | Near-white | Near-black |
| `foreground` | Ordinary text | Near-black | Near-white |
| `primary` | The brand; main buttons | Deep teal | Brighter teal |
| `muted-foreground` | Less important text | Grey | Lighter grey |
| `destructive` | Danger — delete, errors | Red | Brighter red |
| `accent` | Highlights | Amber | Brighter amber |

Two things make this work:

**Every colour comes in pairs.** `primary` always travels with
`primary-foreground` — the colour guaranteed to be readable *on* it. You never
have to wonder whether white text will show up on that button.

**The teal changes between modes.** The deep teal that looks rich on white is
too dark on a black page. So dark mode uses a brighter one. This is why "just
invert the colours" produces bad dark modes — the *relationships* have to be
rebuilt, not flipped.

### 5.2 The logo, and how it was picked

The app shipped for a long time with a teal square containing the letters "TF".
A placeholder.

**Ten designs were drawn and looked at.** That mattered — several ideas that
sounded good on paper failed the moment they were on screen:

| Idea | What it actually looked like |
|---|---|
| An abstract "flowing T" | A cursive lowercase *t* |
| Stacked chevrons | The fast-forward button on a video player |
| Stacked bars | The "align text" icon in a word processor |
| A shield with a tick | Antivirus software |
| **A folded page with rising bars** ✅ | A document that is doing well |

The winner says what the product *is* on sight — a document tool — which matters
for something sitting in a list beside other business software.

**The tie-break was a technical test.** The runner-up was the same page with a
rising arrow. The bars won because at **16 pixels** — the size of the little
icon in a browser tab — three separate vertical strokes stay readable, while a
diagonal arrow blurs into a smudge.

> **The lesson:** a logo is not judged at poster size. It is judged at the
> smallest size it must survive.

The mark is also **drawn in code**, not saved as a picture, so it can take its
colours from the theme. A fixed-colour picture would either wash out on dark or
glare on light.

### 5.3 Designing for email, which is a hostile place

Email is roughly 20 years behind the web. Modern layout tools do not work.
Outlook uses Microsoft Word to draw emails.

**The problem we hit.** The logo was added as a single image at the top. It
looked lovely — and then it was tested with images blocked, which is the
**default** in most email programs. The header was completely empty: an image
with a fixed 32-pixel size collapses to an empty box, and its alt text is
clipped out of sight.

**The fix:** the mark stays an image, but the words "TenderFlow AI" are **real
text** beside it.

| Images on | Images off |
|---|---|
| Logo + wordmark | Wordmark still reads |

And because the words are there, the image is marked **decorative** with empty
alt text — otherwise a screen reader would announce the brand twice.

Other email-specific compromises, each with a reason:

- Laid out with an old-fashioned `<table>`, because Outlook ignores modern
  layout.
- The image is sent at 128 pixels but shown at 32, so it stays sharp on
  high-resolution screens.
- Size is set as an **attribute** as well as a style, because Outlook ignores
  the style.
- Buttons are `inline-block`, without which some programs drop the padding and
  the button collapses into plain underlined text.

### 5.4 Accessibility, as a design constraint

Not an add-on. Baked in:

- **Colour is never the only signal.** Every status carries an icon or a shape
  too.
- **Everything works from the keyboard.** Some people cannot use a mouse.
- **Focus is always visible** — you can see where you are.
- **Screen readers get the right announcements**: errors interrupt; confirmations
  wait their turn.
- **Motion can be turned off**, respecting the setting people with vestibular
  disorders use.

One small, thoughtful detail: the show-password eye is deliberately **skipped**
when you press Tab. Someone tabbing out of the password field expects the sign-in
button, not a control they never asked for. It is still reachable by clicking,
and still announced properly.

### 5.5 Words are design too

Compare:

| Before | After |
|---|---|
| `CredentialsSignin` | That email and password combination doesn't match an account. Check them and try again. |
| Invalid signup details | Password needs: an uppercase letter |
| Something went wrong | This password has appeared in 253,616 known data breaches. Choose a different one. |

The right-hand column tells you **what happened** and **what to do**. It also
never blames you and never shouts. There is a test that fails the build if any
message contains an exclamation mark or the phrase "you failed" — because tone
is the thing that quietly rots as a codebase grows.

---

## Part 6 — Product management

Product management answers: **what should we build, for whom, and why not the
other thing?** Every "yes" is a "no" to something else.

### 6.1 The problem, stated precisely

> A small company in Nigeria wants to bid for a contract. The rulebook is 80
> pages. Missing one rule means instant rejection. Big competitors have whole
> teams for this; the small company has one person doing it at midnight.

Notice what that sentence contains: **who** (small companies), **where**
(Nigeria), **what hurts** (rejection over a missed rule), and **why they cannot
just try harder** (no team). A problem stated that precisely answers most design
questions on its own.

### 6.2 The constraints that shaped everything

Real projects are shaped more by limits than by ambitions:

| Constraint | What it forced |
|---|---|
| **No money to spend** until customers pay | Every service must have a free tier and a working fallback |
| **Nigerian market** | Paystack, not Stripe. Prices in Naira |
| **Users on mobile data** | Server-rendered pages; small downloads |
| **Solo developer** | One codebase, one language, no microservices |
| **Enterprise buyers** | Audit logs, teams, roles, privacy and terms pages — before they will sign |

That first row explains a surprising amount. AI has a local fallback. Storage has
a local fallback. Rate limiting has a local fallback. Not architectural purity —
the inability to pay for reliability, turned into a design principle that turned
out to be better anyway.

### 6.3 The order things were built in

Ordering is most of product management. This is roughly what happened:

1. **Upload a document and get requirements out of it.** The core magic. Without
   this the product has no reason to exist.
2. **Show the checklist.** The magic made visible.
3. **Accounts and projects.** Now people can keep their work.
4. **Drafting.** Move from "tells me what to do" to "helps me do it".
5. **Export.** Without a file to submit, the whole thing is a toy.
6. **Payments.** Only once it was worth paying for.
7. **Teams.** Only once single users were happy.
8. **Security hardening.** Before real customer data arrives.

**Why this order?** Each step is useless without the one before it. Building
teams before drafting would mean several people collaborating on nothing.

A common mistake is building step 6 first, because payments feel like "the
business". You cannot charge for a product that does not work yet.

### 6.4 Free limits as a product decision, not a technical one

| | Starter (free) | Pro |
|---|---|---|
| Document uploads / month | 100 | 500 |
| AI generations / month | 10 | 100 |
| Price | Free | ₦5,000 / month |

The interesting number is **10 AI generations**. That is enough to genuinely
finish one real bid — so a new user can experience winning something, not just
sampling. It is not enough to run a bid business on. The free tier is designed
to prove the value, then run out at exactly the point where the product has
started earning its keep.

The limit is a **soft cap**: it blocks a new action once you have hit the limit,
rather than refusing an action that *might* exceed it. Since one request can
produce several sections, predicting is unreliable — so it does not try.

### 6.5 Decisions that cost usability to earn trust

Three places where the harder path was chosen, with the cost stated honestly.

**1. Signup will not tell you if an email is already registered.**

*The cost:* someone who forgot they had an account gets a confusing "check your
inbox" instead of "you already have an account".

*The reason:* otherwise anyone can type emails into your signup form and learn
who your customers are. For a product where customers are companies bidding on
contracts, "who uses TenderFlow" is commercially sensitive.

*The compromise:* the answer still gets delivered — by email, to the person who
actually owns the address. They are told an account exists, with links to sign
in or reset. And if it was not them, they learn someone else just tried.

**2. New accounts must confirm their email before signing in.**

*The cost:* one extra step, and total dependence on email delivery.

*The reason:* an unconfirmed account can be created for an address you do not
own.

*The compromise:* it applies **only to new accounts**. Everyone who signed up
earlier is unaffected — verified against the real database before shipping,
where **0** existing accounts were locked out. And because email had genuinely
been broken for weeks, there is now a way to request a fresh link **without
signing in** — otherwise the people who most needed it would have been the ones
who could not ask.

**3. Sign-in does not tell you which part was wrong.**

*The cost:* slightly less helpful.

*The reason:* "no account with that email" is a free membership check for
anyone who asks.

### 6.6 What is deliberately not built

Knowing what to leave out matters as much as what to include:

| Not built | Why |
|---|---|
| Real-time collaborative editing | Very hard; bid teams are small and rarely type at once |
| A job queue | Current volumes do not need one. Real complexity, real cost |
| Automatic recurring billing | Needs a payment relationship that does not exist yet; renewal reminders cover it |
| Mobile apps | The website works on phones. Two more codebases would not pay for themselves |
| OCR for scanned PDFs | Genuinely wanted, genuinely expensive. For now the app *says clearly* it cannot read the file, which is better than pretending |

That last row is the pattern worth copying: when you cannot solve something,
**failing clearly** beats failing silently.

### 6.7 How quality is actually kept

Not by intention — by making the computer check:

- **250 automated tests** across the two tiers.
- **Type checking** — the computer proves the pieces fit before it will build.
- **Linting** — an automatic reviewer catching known mistakes.
- **Tests that pin *behaviour*, not text.** The password placeholder test checks
  it is valid and correctly costly, not that it equals a particular string. So
  the test still protects you after someone edits the value.
- **Tone tests.** The build fails if a user-facing message contains an
  exclamation mark or blames the reader.

That last one is unusual and worth stealing. Writing quality decays as a
codebase grows and many hands touch it. Making it a test makes it survive.

---

## Appendix A — Every package, explained

> **A package** (or **library**) is code somebody else wrote that you borrow
> instead of writing it yourself. You list the ones you want, and a tool
> downloads them.
>
> Every package is a trade. You get working code for free — and you take on
> someone else's bugs, someone else's security holes, and a download your users
> must wait for. So each one should earn its place.

This project has **41 packages it ships with** and **~19 development tools**.
Here is every one.

### The foundation

**`next`** — The framework. Provides page routing, server rendering, the API
routes, and the build system. Everything else sits on it.
*Why not alternatives:* Remix is excellent and similar; Astro is better for
content sites but weaker for app-like interactivity; plain React would require
building the backend separately. Next won on having pages and backend in one
project.

**`react`** and **`react-dom`** — The library that turns data into screens. You
describe what the screen *should* look like for some data, and React works out
the minimum changes needed. `react` is the thinking; `react-dom` is the part that
actually touches the browser.
*Why not alternatives:* Vue and Svelte are both very good — Svelte produces
smaller downloads. React won on the size of its ecosystem: TipTap, Radix,
react-hook-form and TanStack Query all exist for React first.

**`typescript`** — Adds types to JavaScript. You say "this is a number", and if
you later treat it as text, the computer refuses to build.
*Why it matters here:* the same shapes travel from database to server to screen.
Types are what make a change in one place break loudly in the others, instead of
quietly in front of a customer.

### Talking to the database

**`prisma`** (tool) and **`@prisma/client`** (code) — You describe your tables
once; Prisma creates them and generates type-safe code to read and write them.
*Why not:* raw SQL gives total control and zero safety; TypeORM and Sequelize
have weaker type safety; Drizzle is a genuinely good lighter alternative that
lost on migration tooling maturity.

**`@prisma/adapter-pg`** — The piece that lets Prisma talk to PostgreSQL
specifically.

**`pg`** — The low-level PostgreSQL driver the adapter uses underneath. You never
call it directly.

### Signing in and staying safe

**`next-auth`** — Handles sessions: proving who you are and remembering it across
pages. Manages the cookies, the tokens, and the sign-in flow.
*Why not:* Clerk and Auth0 are excellent and cost money — impossible under a
no-spend constraint. Rolling your own session handling is a classic way to ship a
security hole.
*Honest note:* this is v4. v5 exists but was in beta when this was built, and
authentication is the wrong place to be an early adopter.

**`@auth/prisma-adapter`** — Connects next-auth to our database, so sessions and
accounts are stored in our own tables.

**`bcryptjs`** — Scrambles passwords one-way (§3.5). The `js` means it is written
in pure JavaScript, so it installs anywhere without needing compilation — which
matters on serverless hosts.
*Why not:* the native `bcrypt` is faster but needs compiling per platform.
Argon2 is stronger but the same install problem, worse.

**`@upstash/ratelimit`** and **`@upstash/redis`** — Counting how many times
someone has tried something, in a shared place all servers can see. Redis is a
very fast store; Upstash is a version that works over plain web requests, which
serverless functions need.
*Why not:* a normal Redis needs a permanent connection, which serverless
functions cannot hold. Counting in memory does not work when each request may
land on a different machine.

### Reading and writing documents

**`pdf-parse`** — Pulls text out of PDFs.
*Its limitation, which shapes the product:* it can only read PDFs that *contain*
text. A scanned page is a photograph, and no text-extractor can read it. That is
why the app detects this and says so, rather than showing an empty checklist.

**`mammoth`** — Pulls text out of Word `.docx` files. Chosen because it converts
to clean, simple output rather than trying to reproduce Word's formatting mess.

**`docx`** — *Creates* Word files, for export. Builds real `.docx` documents
that open properly in Word, Google Docs, and LibreOffice.

**`pdfkit`** — *Creates* PDF files, for export.
*Why two export libraries:* because buyers demand specific formats, and "just
send a PDF" is not always allowed.

### The AI part

**`@google/genai`** — The official client for Google's Gemini models. Used to
read tender documents more intelligently than our own recipes can, and to help
draft proposals.
*Why Gemini:* it has a genuinely usable free tier, which was decisive under the
no-spend constraint. OpenAI and Anthropic models are strong alternatives; both
cost money from the first request.
*How it is used carefully:* the app asks for JSON specifically, validates the
shape of what comes back with Zod, and if anything at all goes wrong, silently
falls back to the local recipes.

### Storing files

**`@supabase/supabase-js`** — Talks to Supabase, which provides both the
PostgreSQL database and file storage on a free tier.
*Why it is needed:* most modern hosting has a **read-only** filesystem. You
cannot simply save an uploaded file next to your code. It has to go somewhere
built for it.
*The fallback:* if Supabase is not configured, files save to local disk — which
is fine for development and would lose files in production. The code says so
plainly in a comment.

### Building screens

**`react-hook-form`** — Form state without redrawing on every keystroke (§4.2).

**`zod`** — Describes what valid data looks like, and checks it. Used for form
input, API input, and validating AI responses.
*The special thing about it:* the description is also the type. One definition
gives you both the runtime check and the compile-time type — they cannot drift.
*Why not:* Yup is similar with weaker TypeScript; Joi is server-only; hand-written
checks drift from your types immediately.

**`@hookform/resolvers`** — The small adapter letting react-hook-form use a Zod
description directly.

**`@radix-ui/*`** (7 packages) — Unstyled, fully accessible building blocks:
`alert-dialog` (confirm before deleting), `checkbox`, `popover` (the account
menu), `select` (dropdowns), `tabs`, `tooltip`, and `slot` (a utility for
composing components).
*Why unstyled matters:* you get years of accessibility work — keyboard handling,
focus management, screen reader support — and still control every pixel.

**`@tanstack/react-query`** — Fetching and caching server data (§4.4). Used in
one file.

**`zustand`** — Small client-side state (§4.4). About 1KB.

**`@tiptap/react`** and **`@tiptap/starter-kit`** — The rich text editor (§4.5).
`starter-kit` bundles the usual extensions: bold, italic, headings, lists.

**`lucide-react`** — The icons. Clean, consistent, and imported one at a time so
only the ones used get downloaded.
*Why not:* Font Awesome ships enormous files; Heroicons is smaller but has fewer
icons; emoji are inconsistent across platforms and read badly to screen readers.

### Styling

**`tailwindcss`** — Styling with small utility classes (§4.6).

**`tailwindcss-animate`** — Adds animation utilities, used for menus and dialogs
appearing.

**`clsx`** — Joins class names together conditionally. `clsx("base", isActive && "active")`.

**`tailwind-merge`** — Solves a real Tailwind problem: if two conflicting classes
end up on one element (`p-2` and `p-4`), which wins is unpredictable. This
resolves them properly, keeping the last.
*Together* these two make the `cn()` helper used throughout the codebase.

**`class-variance-authority`** — Lets a component have named variants — a button
that is `primary` or `destructive`, `small` or `large` — without a tangle of
conditionals.

**`postcss`** and **`autoprefixer`** — Build-time CSS tools. PostCSS is the
processor Tailwind runs inside; autoprefixer adds the browser-specific prefixes
some CSS still needs.

### Keeping it running

**`@sentry/nextjs`** — Error tracking. When something breaks for a real user,
this records what happened and where.
*Why it matters:* without it you find out about bugs when someone complains,
which is both late and rare — most people just leave.

**`dotenv`** — Loads settings (database address, API keys) from a `.env` file,
so secrets live outside the code and never reach version control.

### Development tools

**`eslint`**, **`eslint-config-next`**, **`@eslint/eslintrc`** — The automatic
code reviewer. Catches unused variables, likely mistakes, and framework-specific
errors. This is what caught the `watch()` problem in §4.3.

**`tsx`** — Runs TypeScript files directly, without compiling first. Used for
scripts and the test runner.

**`@types/*`** (7 packages) — Type descriptions for libraries written in plain
JavaScript, so TypeScript can still check your use of them.

### Two honest admissions

**`better-sqlite3`** and **`@prisma/adapter-better-sqlite3`** — Leftovers from
when the project used SQLite before moving to PostgreSQL. They appear in the
build configuration but **nothing imports them**.

**`framer-motion`** (animation) and **`date-fns`** (date formatting) — Both
declared, both **used in zero files**. Verified by searching the whole codebase.

That is four packages being downloaded and installed for nothing. Not a
catastrophe, but worth knowing: **dependency lists rot**. Things get added during
an experiment and never removed. Checking occasionally is a real maintenance
task, and admitting it here is more useful than a tidy list that hides it.

---

## Appendix B — What is wrong or unfinished

Every real project has this list. Most never write it down.

### Unused packages

| Package | Status |
|---|---|
| `framer-motion` | Declared, never imported |
| `date-fns` | Declared, never imported |
| `better-sqlite3` | Left over from the SQLite era |
| `@prisma/adapter-better-sqlite3` | Same |

### Known weaknesses

**Coverage detection uses exact text matching** (§2.9). It measures copying, not
covering. The fix is word-overlap comparison.

**Quality review only finds problems on its list.** A blocklist cannot detect
anything it has not been told about.

**No OCR.** Scanned PDFs cannot be read at all. The app says so clearly, which is
the right behaviour, but it is a real limitation for government documents that
are often scans.

**Rate limiting needs Upstash configured in production.** Without it the counting
happens in memory, and on serverless hosting each request may land on a different
machine — so the limit barely binds. The code warns loudly about this rather than
failing silently.

**TanStack Query is used once.** Worth either using more or removing.

### Operational things to know

**`NEXT_PUBLIC_APP_URL` must be the real deployed address.** Email links, invite
links, and the logo in emails are all built from it. A wrong value means links
that go nowhere.

**Email delivery is a single point of failure.** New accounts cannot sign in
until they confirm by email. If email breaks, signup effectively breaks. This is
why the "send me a new link" page exists without needing a sign-in.

**`middleware` is deprecated in Next 16.** It still works, and it is what
enforces the security policy, but it will need renaming to `proxy` eventually.

---

## Where to start reading the code

If you want to actually explore it:

**To understand the thinking**, start with
`src/features/tender-intelligence/pipeline.ts`. Pure functions, no database, no
network. Everything in Part 2 is in that one file.

**To understand the security**, read `src/lib/auth.ts` and
`src/lib/password-policy.ts` together, then the tests in
`src/lib/password-policy.test.ts` — they explain the timing attack better than
prose can.

**To understand the shape of the data**, read `prisma/schema.prisma`. All 25
tables, in one file.

**To understand a full request**, follow one upload:
`src/app/api/projects/[projectId]/documents/route.ts` → `features/documents/upload.ts`
→ `features/documents/parser.ts` → `server/document-processing.ts`.

**To understand the writing**, read `src/lib/messages.ts`. Small, and the rules
at the top explain themselves.

---

*Every number in this guide — 253,616 breach sightings, 266 milliseconds, 50 of
65 failing tests, 0 accounts locked out — was measured against this repository,
not estimated.*
