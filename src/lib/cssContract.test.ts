import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Guards invariants in the stylesheets that fail silently and cost real
 * interactivity. The first two were shipped broken once: the deck was entirely
 * unclickable and the setup screen swallowed every input.
 *
 * Not a CSS parser. It only has to read this project's own stylesheets, which
 * prettier normalises on every commit and which CI formats before it tests.
 */
const css = ['../index.css', '../glass.css']
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n')

type Rule = { selector: string; body: string }

/** Comments go first, over the whole source. Stripping them only from
 *  selectors would let a commented-out declaration inside a rule body satisfy
 *  one of these assertions without doing anything. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

function rules(source: string): Rule[] {
  const out: Rule[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(stripComments(source))) !== null) {
    const selector = match[1].trim()
    if (selector && !selector.startsWith('@')) out.push({ selector, body: match[2] })
  }
  return out
}

const all = rules(css)

describe('stylesheet interaction contract', () => {
  it('finds rules at all, so a parser change cannot silently pass everything', () => {
    expect(all.length).toBeGreaterThan(100)
  })

  it('does not count a commented-out declaration as satisfying the contract', () => {
    const [rule] = rules('.x::after { position: absolute; /* pointer-events: none; */ }')
    expect(rule.body).not.toContain('pointer-events')
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

  it('never makes the page chrome a containing block for the fixed modal backdrop', () => {
    // Any of these on html, body, .app or .main makes it the containing block
    // for .modal-backdrop (position: fixed; inset: 0), which then covers the
    // whole document instead of the viewport, and both modals break on a long
    // page.
    expect(chromeOffenders(all)).toEqual([])
  })

  it('detects that violation, including under a style scope', () => {
    const offenders = chromeOffenders(
      rules(`
        .main { transform: translateY(1px); }
        :root[data-style='glass'] .app { backdrop-filter: blur(4px); }
        :root { -webkit-backdrop-filter: blur(4px); }
        body::before { transform: translate3d(0, 0, 0); }
        .main-nav { filter: blur(1px); }
        .app .card { backdrop-filter: blur(4px); }
        table.prs tbody { transform: none; }
        .main { padding: 4px; }
      `),
    )
    expect(offenders).toEqual(['.main', ":root[data-style='glass'] .app", ':root'])
  })
})

const CHROME = /(^|[\s>+~(])(html|body|\.app|\.main|:root)(?![-\w:])/
const CONTAINING_BLOCK =
  /(^|[;\s])(-webkit-backdrop-filter|backdrop-filter|filter|transform|perspective):/

/** Rules whose subject is the page chrome and that set a containing-block
 *  property. Only the last compound selector is the subject, and
 *  pseudo-elements are exempt: they are leaves, which is why the ambient
 *  layers can live on body::before / ::after. */
function chromeOffenders(source: Rule[]): string[] {
  return source
    .flatMap((r) =>
      r.selector.split(',').map((selector) => ({ selector: selector.trim(), body: r.body })),
    )
    .filter((r) => {
      const subject = r.selector.split(/\s+/).pop() ?? ''
      return CHROME.test(` ${subject}`) && !subject.includes('::')
    })
    .filter((r) => CONTAINING_BLOCK.test(r.body))
    .map((r) => r.selector)
}
