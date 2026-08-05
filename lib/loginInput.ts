const INVISIBLE_AUTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

export function cleanLoginEmail(value: unknown) {
  return String(value ?? "").replace(INVISIBLE_AUTH_CHARS, "").trim().toLowerCase();
}

export function getPasswordCandidates(value: unknown) {
  const raw = String(value ?? "").replace(INVISIBLE_AUTH_CHARS, "");
  const trimmed = raw.trim();
  return [...new Set([raw, trimmed].filter((item) => item.length > 0))];
}
