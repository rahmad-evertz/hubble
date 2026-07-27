import { describe, expect, it } from 'vitest'
import { parsePatch, lineMatchesThread, indexThreadsByLine, threadsForLine } from './diff'

describe('parsePatch', () => {
  it('returns unavailable for null patch', () => {
    expect(parsePatch(null)).toEqual({ available: false })
  })

  it('returns unavailable for undefined patch', () => {
    expect(parsePatch(undefined)).toEqual({ available: false })
  })

  it('parses a simple single-hunk patch', () => {
    const patch = `@@ -1,3 +1,4 @@
 line 1
 line 2
+line 3
 line 4`

    const result = parsePatch(patch)
    expect(result.available).toBe(true)
    if (!result.available) return

    expect(result.hunks).toHaveLength(1)
    const hunk = result.hunks[0]
    expect(hunk.oldStart).toBe(1)
    expect(hunk.oldLines).toBe(3)
    expect(hunk.newStart).toBe(1)
    expect(hunk.newLines).toBe(4)
    expect(hunk.lines).toHaveLength(4)
    expect(hunk.lines[0]).toEqual({ type: 'context', oldLine: 1, newLine: 1, content: 'line 1' })
    expect(hunk.lines[2]).toEqual({ type: 'add', oldLine: null, newLine: 3, content: 'line 3' })
  })

  it('handles pure-add hunks with @@ -0,0 +1,N @@', () => {
    const patch = `@@ -0,0 +1,2 @@
+new line 1
+new line 2`

    const result = parsePatch(patch)
    expect(result.available).toBe(true)
    if (!result.available) return

    const hunk = result.hunks[0]
    expect(hunk.oldStart).toBe(0)
    expect(hunk.oldLines).toBe(0)
    expect(hunk.newStart).toBe(1)
    expect(hunk.newLines).toBe(2)
    expect(hunk.lines[0].newLine).toBe(1)
    expect(hunk.lines[1].newLine).toBe(2)
  })

  it('handles pure-delete hunks', () => {
    const patch = `@@ -1,2 +0,0 @@
-old line 1
-old line 2`

    const result = parsePatch(patch)
    expect(result.available).toBe(true)
    if (!result.available) return

    const hunk = result.hunks[0]
    expect(hunk.oldStart).toBe(1)
    expect(hunk.oldLines).toBe(2)
    expect(hunk.newStart).toBe(0)
    expect(hunk.newLines).toBe(0)
    expect(hunk.lines[0].oldLine).toBe(1)
    expect(hunk.lines[0].newLine).toBeNull()
  })

  it('handles the no-newline-at-end-of-file marker', () => {
    const patch = `@@ -1,2 +1,2 @@
 line 1
-line 2
\\ No newline at end of file
+line 2 modified
\\ No newline at end of file`

    const result = parsePatch(patch)
    expect(result.available).toBe(true)
    if (!result.available) return

    const hunk = result.hunks[0]
    expect(hunk.lines[hunk.lines.length - 1].noNewlineAtEnd).toBe(true)
  })

  it('parses multiple hunks', () => {
    const patch = `@@ -1,2 +1,3 @@
 line 1
+inserted
 line 2
@@ -10,2 +11,2 @@
 line 10
 line 11`

    const result = parsePatch(patch)
    expect(result.available).toBe(true)
    if (!result.available) return

    expect(result.hunks).toHaveLength(2)
    expect(result.hunks[0].newStart).toBe(1)
    expect(result.hunks[1].newStart).toBe(11)
  })

  it('defaults to count=1 when count is omitted in hunk header', () => {
    const patch = `@@ -1 +1,2 @@
 line 1
+new line`

    const result = parsePatch(patch)
    expect(result.available).toBe(true)
    if (!result.available) return

    const hunk = result.hunks[0]
    expect(hunk.oldLines).toBe(1)
    expect(hunk.newLines).toBe(2)
  })
})

describe('lineMatchesThread', () => {
  it('matches RIGHT-anchored threads to newLine', () => {
    const line = { type: 'add' as const, oldLine: null, newLine: 5, content: 'text' }
    expect(lineMatchesThread(line, { line: 5, diffSide: 'RIGHT' })).toBe(true)
    expect(lineMatchesThread(line, { line: 6, diffSide: 'RIGHT' })).toBe(false)
  })

  it('matches LEFT-anchored threads to oldLine', () => {
    const line = { type: 'del' as const, oldLine: 3, newLine: null, content: 'text' }
    expect(lineMatchesThread(line, { line: 3, diffSide: 'LEFT' })).toBe(true)
    expect(lineMatchesThread(line, { line: 4, diffSide: 'LEFT' })).toBe(false)
  })

  it('matches context lines to either side', () => {
    const line = { type: 'context' as const, oldLine: 2, newLine: 2, content: 'text' }
    expect(lineMatchesThread(line, { line: 2, diffSide: 'RIGHT' })).toBe(true)
    expect(lineMatchesThread(line, { line: 2, diffSide: 'LEFT' })).toBe(true)
  })

  it('rejects null-line anchors', () => {
    const line = { type: 'context' as const, oldLine: 1, newLine: 1, content: 'text' }
    expect(lineMatchesThread(line, { line: null, diffSide: 'LEFT' })).toBe(false)
  })
})

describe('indexThreadsByLine', () => {
  it('builds an index keyed by diffSide:line', () => {
    const threads = [
      { id: 't1', line: 5, diffSide: 'RIGHT' as const },
      { id: 't2', line: 5, diffSide: 'RIGHT' as const },
      { id: 't3', line: 3, diffSide: 'LEFT' as const },
    ]

    const index = indexThreadsByLine(threads)
    expect(index.get('RIGHT:5')).toHaveLength(2)
    expect(index.get('LEFT:3')).toHaveLength(1)
  })

  it('excludes null-line threads', () => {
    const threads = [
      { id: 't1', line: 5, diffSide: 'RIGHT' as const },
      { id: 't2', line: null, diffSide: 'RIGHT' as const },
    ]

    const index = indexThreadsByLine(threads)
    expect(index.get('RIGHT:5')).toHaveLength(1)
    expect(index.has('RIGHT:null')).toBe(false)
  })
})

describe('threadsForLine', () => {
  it('returns threads anchored to the line and diffSide', () => {
    const threads = [
      { id: 't1', line: 5, diffSide: 'RIGHT' as const },
      { id: 't2', line: 5, diffSide: 'LEFT' as const },
      { id: 't3', line: 6, diffSide: 'RIGHT' as const },
    ]
    const index = indexThreadsByLine(threads)

    const line = { type: 'context' as const, oldLine: 5, newLine: 5, content: 'text' }
    const result = threadsForLine(line, index)
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('returns only RIGHT threads for add lines', () => {
    const threads = [
      { id: 't1', line: 3, diffSide: 'RIGHT' as const },
      { id: 't2', line: 3, diffSide: 'LEFT' as const },
    ]
    const index = indexThreadsByLine(threads)

    const line = { type: 'add' as const, oldLine: null, newLine: 3, content: 'text' }
    const result = threadsForLine(line, index)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('returns empty array when no threads match', () => {
    const threads = [{ id: 't1', line: 10, diffSide: 'RIGHT' as const }]
    const index = indexThreadsByLine(threads)

    const line = { type: 'context' as const, oldLine: 1, newLine: 1, content: 'text' }
    const result = threadsForLine(line, index)
    expect(result).toHaveLength(0)
  })
})
