# TenderFlow AI — brand assets

The mark is a folded page whose interior lines rise like a bid that is
winning. It was chosen over the alternatives because it is the only one that
names the category on sight: an abstract flow ribbon, an upward arrow and a
shield all read as some other kind of product (media player, fintech,
antivirus). A tender tool should look like documents.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | The mark, fixed colours. Anywhere the theme is not available. |
| `mark-mono.svg` | One colour via `currentColor`. Stamps, faxes, embossing, single-colour print. |
| `lockup.svg` | Mark + wordmark, horizontal. Letterheads, decks, partner listings. |
| `mark-{32,64,128,256,512}.png` | Raster, transparent. Email signatures, social avatars, app listings. |
| `lockup-{440,880}.png` | Raster lockup for documents and slides. |
| `alt-mark-arrow.svg` | The runner-up: same page, rising arrow instead of bars. |

In the app, use the React component instead of these files — it takes its
colours from the theme, which a fixed-colour file cannot:

```tsx
import { Logo, LogoMark } from "@/components/brand/logo";

<Logo showSubtitle />              // full lockup
<LogoMark className="size-8" />    // mark alone, e.g. a collapsed sidebar
<Logo tone="onDark" />             // on a fixed dark panel, e.g. the auth page
```

`src/app/icon.svg` is the favicon; Next serves it automatically.

## Colour

| Token | Light | Dark |
| --- | --- | --- |
| Page | `#0F6B64` (`--primary`) | `#1EB8A8` |
| Bars | `--primary-foreground` | `--primary-foreground` |
| Fold | page colour at 25% black | same |

The bars deliberately use `primary-foreground` rather than a fixed white:
that token is the one already guaranteed to be legible on `primary` in both
themes, so the mark cannot wash out when the theme flips.

## Clear space and minimum size

Keep clear space of at least the width of one bar on every side. The mark
holds down to 16px; below that use a solid `--primary` square instead. The
lockup should not be set below 120px wide — under that, set the mark alone.

## Don't

- Recolour the page to anything outside the teal ramp.
- Add a drop shadow, gradient, or outline.
- Stretch: the mark is square, the lockup is 220x48.
- Re-typeset the wordmark in another face. It is the app's sans, semibold,
  with "AI" in regular at reduced emphasis.

## Email

`src/lib/email/templates.ts` builds one header for all six emails: the mark as
an image plus the wordmark as HTML text.

The wordmark is text on purpose. Most mail clients block remote images until
the reader allows them, and an image-only header would open as an empty box —
a fixed `width`/`height` clips the alt text out of sight, so nothing at all
shows. With the words in HTML the email is branded either way, which is why
the image carries `alt=""`: it is decorative, and a real alt would make a
screen reader announce the name twice.

The image is served from `public/brand/mark-128.png` at
`${NEXT_PUBLIC_APP_URL}/brand/mark-128.png`. That variable must be the
deployed origin in production — a relative path resolves against the mail
client's own domain, and a localhost value is unreachable from an inbox.

Keep `public/brand/mark-128.png` in step with `mark.svg` if the mark ever
changes; it is a copy, not a build step.

Calls to action use the brand teal `#0F6B64` with white text — 6.35:1, past
AA for the 14px label. They are built by one `button()` helper rather than
written out per template, so the four emails that have a button cannot drift
apart, and `display: inline-block` is what keeps the padding from collapsing
into plain underlined text in the clients that drop padding on inline anchors.
