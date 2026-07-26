/**
 * Optional issue-key linking. Off unless the user configures both a pattern and
 * a base URL, which is what keeps any specific issue tracker out of the source.
 */
export function extractTicket(text: string, pattern: string): string | null {
  if (!pattern) return null
  try {
    const match = new RegExp(pattern).exec(text)
    // Prefer the first capture group, falling back to the whole match.
    return match ? (match[1] ?? match[0]) : null
  } catch {
    // A user-supplied regex can be invalid mid-typing; treat it as "no link".
    return null
  }
}

export function ticketUrl(key: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${key}`
}

/** Age thresholds used for the age pill; tuned to "a week" and "three weeks". */
export function ageSeverity(days: number): 'fresh' | 'aging' | 'stale' {
  if (days > 21) return 'stale'
  if (days > 7) return 'aging'
  return 'fresh'
}
