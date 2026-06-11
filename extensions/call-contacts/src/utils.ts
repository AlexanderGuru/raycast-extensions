/** Pure helpers — no Raycast imports so they are unit-testable. */

/** Keep only `+` and digits so tel:/facetime:/sms: links are well-formed. */
export function normalizeNumber(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? "+" + digits : digits;
}

/**
 * Clean up a phone label for display: raw AppleScript-style labels like
 * "_$!<Mobile>!$_" become "Mobile"; already-localized labels ("móvil")
 * just get their first letter capitalized.
 */
export function prettyLabel(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  const label = m ? m[1] : raw;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Custom filtering instead of Raycast's built-in one: the built-in filter
 * only matches word prefixes, so typing the middle of a phone number
 * ("234" for "+79161234567") would find nothing. Here digits match as a
 * substring of the normalized number, and text matches name/org/label.
 */
export function matchesQuery(
  fields: { name: string; org: string; label: string; number: string },
  query: string,
  queryDigits: string,
): boolean {
  const haystack = `${fields.name} ${fields.org} ${fields.label}`.toLowerCase();
  if (haystack.includes(query)) return true;
  return queryDigits.length > 0 && fields.number.includes(queryDigits);
}

/**
 * If the search text itself looks like a phone number (only digits and
 * common separators, at least 3 digits), return it normalized — so the
 * user can dial a number that is not in the contacts.
 */
export function parseDialableNumber(searchText: string): string | null {
  const trimmed = searchText.trim();
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return null;
  const number = normalizeNumber(trimmed);
  return number.replace("+", "").length >= 3 ? number : null;
}
