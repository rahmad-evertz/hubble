import * as storage from './storage'
import { isValidRepo } from './validate'

const STORAGE_KEY = 'archivedRepos'

/**
 * Sorted and deduped, so the list doubles as a stable cache key. Anything that
 * is not a valid owner/name is dropped: a hand-edited entry would otherwise
 * make every panel query throw.
 */
function normalise(repos: unknown[]): string[] {
  const valid = repos.filter((r): r is string => typeof r === 'string' && isValidRepo(r))
  return [...new Set(valid)].sort((a, b) => a.localeCompare(b))
}

export function loadArchivedRepos(): string[] {
  const stored = storage.read<unknown>(STORAGE_KEY, [])
  return Array.isArray(stored) ? normalise(stored) : []
}

export function saveArchivedRepos(repos: string[]): string[] {
  const next = normalise(repos)
  storage.write(STORAGE_KEY, next)
  return next
}
