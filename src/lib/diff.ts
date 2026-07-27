import type { DiffSide } from '../types'

export type DiffLineType = 'context' | 'add' | 'del'

export type DiffLine = {
  type: DiffLineType
  oldLine: number | null
  newLine: number | null
  content: string
  noNewlineAtEnd?: boolean
}

export type DiffHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  sectionHeading: string
  lines: DiffLine[]
}

export type ParsedDiff = { available: true; hunks: DiffHunk[] } | { available: false }

export function parsePatch(patch: string | null | undefined): ParsedDiff {
  if (!patch) return { available: false }

  const lines = patch.split('\n')
  const hunks: DiffHunk[] = []
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
    if (hunkMatch) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        sectionHeading: hunkMatch[5].trim(),
        lines: [],
      }
      oldLine = currentHunk.oldStart
      newLine = currentHunk.newStart
      hunks.push(currentHunk)
      continue
    }

    if (!currentHunk) continue

    // Handle "\ No newline at end of file" marker
    if (line === '\\ No newline at end of file') {
      if (currentHunk.lines.length > 0) {
        currentHunk.lines[currentHunk.lines.length - 1].noNewlineAtEnd = true
      }
      continue
    }

    // Skip empty trailing lines
    if (i === lines.length - 1 && line === '') continue

    // Parse diff line
    if (!line) continue // skip truly empty lines within the patch

    const marker = line[0]
    const content = line.substring(1)

    let diffLine: DiffLine | null = null

    if (marker === ' ') {
      diffLine = { type: 'context', oldLine, newLine, content }
      oldLine++
      newLine++
    } else if (marker === '+') {
      diffLine = { type: 'add', oldLine: null, newLine, content }
      newLine++
    } else if (marker === '-') {
      diffLine = { type: 'del', oldLine, newLine: null, content }
      oldLine++
    }

    if (diffLine) {
      currentHunk.lines.push(diffLine)
    }
  }

  return { available: true, hunks }
}

export type ThreadAnchor = { line: number | null; diffSide: DiffSide }

export function lineMatchesThread(line: DiffLine, anchor: ThreadAnchor): boolean {
  if (anchor.line === null) return false
  if (anchor.diffSide === 'RIGHT') return line.newLine === anchor.line
  if (anchor.diffSide === 'LEFT') return line.oldLine === anchor.line
  return false
}

export function indexThreadsByLine<T extends ThreadAnchor>(threads: T[]): Map<string, T[]> {
  const index = new Map<string, T[]>()
  for (const thread of threads) {
    if (thread.line === null) continue
    const key = `${thread.diffSide}:${thread.line}`
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push(thread)
  }
  return index
}

export function threadsForLine<T extends ThreadAnchor>(
  line: DiffLine,
  indexed: Map<string, T[]>,
): T[] {
  const threads: T[] = []
  if (line.newLine !== null) {
    const rightKey = `RIGHT:${line.newLine}`
    threads.push(...(indexed.get(rightKey) ?? []))
  }
  if (line.oldLine !== null) {
    const leftKey = `LEFT:${line.oldLine}`
    threads.push(...(indexed.get(leftKey) ?? []))
  }
  return threads
}
