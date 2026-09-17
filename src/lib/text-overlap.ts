/**
 * Word-overlap primitives shared by the parts of the product that have to
 * decide whether two pieces of text are about the same thing: which saved
 * answers suit a section, and whether a draft actually addresses a
 * requirement.
 *
 * They lived in the content library first. Coverage detection needed the same
 * decisions - which words carry no signal, how to compare texts of wildly
 * different lengths - and two copies would have drifted into two different
 * answers for the same question.
 */

/**
 * Words that appear in nearly every tender and nearly every proposal, so
 * their presence says nothing about whether two texts are about the same
 * thing. The domain half of this list matters more than the grammar half:
 * without it, every entry matches every section on "proposal", "tender" and
 * "project", and the scores collapse into noise.
 */
const STOPWORDS = new Set([
  // ordinary english
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "has", "have", "in", "into", "is", "it", "its", "of", "on", "or",
  "our", "that", "the", "their", "then", "there", "these", "this", "to",
  "was", "we", "were", "will", "with", "you", "your", "shall", "must",
  "any", "all", "not", "which", "who", "how", "what", "when", "where",
  // words this product's documents are made of
  "proposal", "proposals", "tender", "tenders", "bid", "bids", "bidder",
  "project", "projects", "section", "sections", "client", "clients",
  "company", "companies", "contract", "contracts", "requirement",
  "requirements", "document", "documents", "provide", "provided",
  "including", "include", "included", "relevant", "please", "ensure",
  // Procurement phrasing that names no subject. Without these, a requirement
  // extracted as "The bidder shall provide the required documents" keeps the
  // single token "required" and is judged against it - so a section is told
  // it is missing something no measurement could confirm it has.
  "required", "require", "requires", "furnish", "furnished", "thereof",
  "hereby", "pursuant", "accordance", "above", "below", "following",
]);

const MIN_TOKEN_LENGTH = 3;

/**
 * Lowercase, split on anything that is not a letter or digit, drop stopwords
 * and very short tokens.
 *
 * Digits are kept and not length-filtered the same way, because the most
 * valuable matches in this domain are codes: ISO 27001, NDPR, VAT, PENCOM.
 * Losing "iso" to a three-letter minimum would lose exactly the entries a
 * bidder most wants found.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const tokens: string[] = [];
  for (const token of raw) {
    if (STOPWORDS.has(token)) continue;
    // Keep short tokens when they contain a digit, so "27001" and "9001"
    // survive alongside the words around them.
    if (token.length < MIN_TOKEN_LENGTH && !/[0-9]/.test(token)) continue;
    tokens.push(token);
  }
  return tokens;
}

export function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/**
 * The fraction of `needle` tokens that appear in `haystack`.
 *
 * Containment rather than Jaccard, because the two sides are deliberately
 * different sizes: a section's title is a handful of words and a saved answer
 * can be several paragraphs. Jaccard would score a thorough answer *worse*
 * than a thin one for being longer, which is backwards.
 */
export function containment(needle: Set<string>, haystack: Set<string>): number {
  if (needle.size === 0) return 0;
  let found = 0;
  for (const token of needle) {
    if (haystack.has(token)) found += 1;
  }
  return found / needle.size;
}

export interface WeightedToken {
  token: string;
  weight: number;
}

/**
 * How much a token says about what a text is actually about.
 *
 * Identifiers carry the meaning of a requirement; the words around them are
 * packaging. "NDPR compliance" is two tokens, and a draft reading "personal
 * data is processed in line with the NDPR" answers it completely while using
 * only one of them - scoring that as half-covered repeats, more quietly, the
 * mistake of demanding the tender's own wording.
 *
 * With no corpus to derive real term frequencies from, two cheap proxies do
 * most of the work: a token containing a digit is a standard or a clause
 * number, and a token written in capitals is an acronym. Both identify a
 * subject far more precisely than the ordinary words beside them.
 */
const IDENTIFIER_WEIGHT = 3;
const ORDINARY_WEIGHT = 1;

function weightOf(original: string): number {
  if (/[0-9]/.test(original)) return IDENTIFIER_WEIGHT;
  // Two letters or more, all capitals: ISO, NDPR, PENCOM, VAT, HSE, FIRS.
  if (original.length >= 2 && original === original.toUpperCase() && /[A-Z]/.test(original)) {
    return IDENTIFIER_WEIGHT;
  }
  return ORDINARY_WEIGHT;
}

/**
 * Tokenize while remembering how much each token counts for. Case is read
 * from the original text, so this has to see it before `tokenize` lowercases.
 */
export function weightedTokens(text: string): WeightedToken[] {
  if (!text) return [];

  const byToken = new Map<string, number>();
  for (const original of text.split(/[^A-Za-z0-9]+/)) {
    if (!original) continue;
    const [token] = tokenize(original);
    if (!token) continue;
    // A token repeated in different forms keeps the strongest reading of it.
    byToken.set(token, Math.max(byToken.get(token) ?? 0, weightOf(original)));
  }

  return Array.from(byToken, ([token, weight]) => ({ token, weight }));
}

/**
 * Containment, but counting identifiers for more than filler.
 *
 * Returns 0 when there is nothing weighable, matching `containment`.
 */
export function weightedContainment(
  needle: readonly WeightedToken[],
  haystack: Set<string>,
): number {
  let total = 0;
  let found = 0;
  for (const { token, weight } of needle) {
    total += weight;
    if (haystack.has(token)) found += weight;
  }
  return total === 0 ? 0 : found / total;
}
