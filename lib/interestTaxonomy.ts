export const INTEREST_OPTIONS = [
  "Fashion & Beauty",
  "Food & Drinks",
  "Music & Entertainment",
  "Tech & Apps",
  "Business & Entrepreneurship",
  "Education & Learning",
  "Gaming & Esports",
  "Events & Social Activities",
  "Health & Fitness",
  "Public Awareness & Social Impact",
  "Real Estate & Home Services",
  "Travel & Hospitality",
  "Faith & Inspiration",
  "Finance & Money",
  "Campus & Student Life",
] as const;

const INTEREST_ALIASES: Record<string, string[]> = {
  "Fashion & Beauty": ["Fashion", "Beauty", "Lifestyle"],
  "Food & Drinks": ["Food", "Food & Restaurants", "Restaurants", "Drinks"],
  "Music & Entertainment": ["Music", "Entertainment", "Musicians & Entertainment"],
  "Tech & Apps": ["Technology", "Tech", "Apps", "App Testing", "App Testing & Reviews"],
  "Business & Entrepreneurship": ["Business", "Entrepreneurship", "Creator Brand", "E-commerce", "Local Business"],
  "Education & Learning": ["Education", "Learning"],
  "Gaming & Esports": ["Gaming", "Esports"],
  "Events & Social Activities": ["Events", "Local Events", "Event Promotion", "Social Activities", "Sports"],
  "Health & Fitness": ["Health", "Fitness"],
  "Public Awareness & Social Impact": ["Public Awareness", "Social Impact", "Community Growth"],
  "Real Estate & Home Services": ["Real Estate", "Home Services"],
  "Travel & Hospitality": ["Travel", "Hospitality"],
  "Faith & Inspiration": ["Faith", "Inspiration", "Church", "Church & Community"],
  "Finance & Money": ["Finance", "Money"],
  "Campus & Student Life": ["Campus", "Student Life", "Students"],
};

const WEAK_INTEREST_WORDS = new Set(["and", "the", "of", "for", "local", "social"]);

export function normalizeInterestValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function interestTokens(value: unknown) {
  return normalizeInterestValue(value)
    .split(" ")
    .filter((token) => token.length > 2 && !WEAK_INTEREST_WORDS.has(token));
}

const CANONICAL_LOOKUP = new Map<string, string>();

for (const interest of INTEREST_OPTIONS) {
  CANONICAL_LOOKUP.set(normalizeInterestValue(interest), interest);
  for (const alias of INTEREST_ALIASES[interest] ?? []) {
    CANONICAL_LOOKUP.set(normalizeInterestValue(alias), interest);
  }
}

export function canonicalizeInterest(value: unknown) {
  const normalized = normalizeInterestValue(value);
  if (!normalized) return "";
  return CANONICAL_LOOKUP.get(normalized) ?? String(value).trim();
}

export function canonicalizeInterests(values: unknown, limit?: number) {
  const raw = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const canonical: string[] = [];

  for (const value of raw) {
    if (typeof value !== "string") continue;
    const interest = canonicalizeInterest(value);
    const key = normalizeInterestValue(interest);
    if (!interest || seen.has(key)) continue;
    seen.add(key);
    canonical.push(interest);
    if (limit && canonical.length >= limit) break;
  }

  return canonical;
}

export function interestMatches(targets: string[], userInterests: string[]) {
  const canonicalTargets = canonicalizeInterests(targets);
  if (canonicalTargets.length === 0) return true;

  const canonicalUsers = canonicalizeInterests(userInterests);
  const normalizedUsers = new Set(canonicalUsers.map(normalizeInterestValue));
  if (canonicalTargets.some((target) => normalizedUsers.has(normalizeInterestValue(target)))) return true;

  const userTokenSets = userInterests.map(interestTokens);
  return targets.some((target) => {
    const targetTokens = interestTokens(target);
    return userTokenSets.some((tokens) => tokens.some((token) => targetTokens.includes(token)));
  });
}
