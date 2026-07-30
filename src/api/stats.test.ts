import { describe, expect, it } from 'vitest'
import type { Stats } from '../types'
import { repoTallyTruncated } from './stats'

/** Only `months[].merged` feeds the truncation check; the rest is filler. */
function statsWithMerged(totalMerged: number): Stats {
  return {
    months: [{ key: '2026-01', merged: totalMerged, reviewedApprox: 0 }],
    lifetime: { authored: 0, merged: 0, reviewed: 0, openAuthored: 0 },
    topRepos: [],
  }
}

describe('repoTallyTruncated', () => {
  // The repo sample search page caps at 100 nodes (REPO_SAMPLE in stats.ts).
  it('is not truncated at or below the 100-PR sample cap', () => {
    expect(repoTallyTruncated(statsWithMerged(100))).toBe(false)
  })

  it('is truncated once merges exceed the sample cap', () => {
    expect(repoTallyTruncated(statsWithMerged(101))).toBe(true)
  })

  it('sums merges across every covered month', () => {
    const stats: Stats = {
      months: [
        { key: '2026-01', merged: 60, reviewedApprox: 0 },
        { key: '2026-02', merged: 60, reviewedApprox: 0 },
      ],
      lifetime: { authored: 0, merged: 0, reviewed: 0, openAuthored: 0 },
      topRepos: [],
    }
    expect(repoTallyTruncated(stats)).toBe(true)
  })
})
