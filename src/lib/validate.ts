/**
 * GitHub logins and org slugs are alphanumeric with single hyphens, max 39
 * chars. Validating here is not cosmetic: these values are interpolated into
 * search query strings, and an unvalidated value containing a space or a colon
 * would silently change the query's meaning rather than error.
 */
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/

export function isValidLogin(value: string): boolean {
  return LOGIN.test(value)
}

export function assertValidLogin(value: string, label: string): string {
  if (!isValidLogin(value)) {
    throw new Error(
      `${label} "${value}" is not a valid GitHub name (letters, digits and single hyphens, up to 39 characters).`,
    )
  }
  return value
}

/** A classic PAT is ghp_…; older tokens are 40 hex chars. Kept loose on purpose. */
export function looksLikeToken(value: string): boolean {
  return value.trim().length >= 20 && !/\s/.test(value.trim())
}
