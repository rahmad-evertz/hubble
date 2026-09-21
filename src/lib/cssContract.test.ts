import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Guards two invariants in index.css that fail silently and cost real
 * interactivity. Both were shipped broken once: the deck was entirely
 * unclickable and the setup screen swallowed every input.
 *
 * Not a CSS parser. It only has to read this project's own stylesheet, which
 * prettier normalises on every commit and which CI formats before it tests.
 */
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

type Rule = { selector: string; body: string }

function rules(source: string): Rule[] {
  const out: Rule[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (selector && !selector.startsWith('@')) out.push({ selector, body: match[2] })
  }
  return out
}

const all = rules(css)

describe('index.css interaction contract', () => {
  it('finds rules at all, so a parser change cannot silently pass everything', () => {
    expect(all.length).toBeGreaterThan(100)
  })

  it('opts every positioned decoration out of pointer events', () => {
    const offenders = all
      .filter((r) => /::(before|after)\b/.test(r.selector))
      .filter((r) => /position:\s*(absolute|fixed)/.test(r.body))
      .filter((r) => !/pointer-events:\s*none/.test(r.body))
      .map((r) => r.selector)

    // An inset: 0 pseudo-element paints over its own box and takes the click.
    // That is how the setup card's depth plates made the token field and every
    // button underneath them unreachable.
    expect(offenders).toEqual([])
  })

  it('never opens a 3D rendering context', () => {
    const offenders = all
      .filter((r) => /transform-style:\s*preserve-3d/.test(r.body))
      .map((r) => r.selector)

    // Chromium resolves hit testing inside a 3D rendering context to the
    // context root, so a 3D-transformed child of a preserve-3d element stops
    // receiving pointer events entirely. Depth comes from the perspective()
    // transform function on each element instead; see .scene-stage.
    expect(offenders).toEqual([])
  })
})
