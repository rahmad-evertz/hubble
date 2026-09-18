import type { PullRequest } from '../types'

export type SortKey = 'activity' | 'age'

/**
 * 'activity' matches the server's own sort:updated-desc default, so picking
 * it changes nothing visually. 'age' goes oldest-first, the useful direction
 * for surfacing neglected PRs, not "newest first".
 */
export function sortPrs(prs: PullRequest[], key: SortKey): PullRequest[] {
  const sorted = [...prs]
  if (key === 'age') {
    sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } else {
    sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  return sorted
}

export type RepoGroup = { repo: string; prs: PullRequest[] }

/**
 * Clusters by repo, groups ordered alphabetically. Does not sort within a
 * group: callers run sortPrs first, so the two concerns compose
 * independently instead of one function doing both.
 */
export function groupByRepo(prs: PullRequest[]): RepoGroup[] {
  const byRepo = new Map<string, PullRequest[]>()
  for (const pr of prs) {
    const list = byRepo.get(pr.repo) ?? []
    list.push(pr)
    byRepo.set(pr.repo, list)
  }
  return [...byRepo.entries()]
    .map(([repo, list]) => ({ repo, prs: list }))
    .sort((a, b) => a.repo.localeCompare(b.repo))
}
